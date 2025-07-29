require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");


const app = express();
const port = process.env.PORT || 5000;

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

console.log("Admin email from env:", process.env.ADMIN_EMAIL);
console.log("Admin password from env:", process.env.ADMIN_PASSWORD);

// Middleware
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());

app.post("/admin-login", (req, res) => {
  const { email, password } = req.body;

  if (email === adminEmail && password === adminPassword) {
    return res.status(200).json({ success: true, message: "Admin logged in" });
  } else {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});



// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@xenpi.9qo9gbb.mongodb.net/?retryWrites=true&w=majority&appName=XenPi`;
const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

let apartmentCollection, agreementCollection, announcementCollection, usersCollection, couponsCollection;



async function run() {
  try {
    await client.connect();

    const db = client.db("Blockwise");
    apartmentCollection = db.collection("apartments");
    agreementCollection = db.collection("agreements");
    announcementCollection = db.collection("announcements");
    usersCollection = db.collection("users");
    couponsCollection = db.collection("coupons");
    paymentsCollection = db.collection("payments")





    // Apartments
    app.get("/apartments", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const minRent = parseInt(req.query.minRent);
      const maxRent = parseInt(req.query.maxRent);
      const limit = parseInt(req.query.limit) || 6;
      const skip = (page - 1) * limit;

      const filter = {};
      if (!isNaN(minRent) && !isNaN(maxRent)) {
        filter.rent = { $gte: minRent, $lte: maxRent };
      }

      const apartments = await apartmentCollection.find(filter).skip(skip).limit(limit).toArray();
      const total = await apartmentCollection.countDocuments(filter);
      res.send({ apartments, total });
    });

    // Agreements
    app.post("/agreements", async (req, res) => {
      const { email, apartmentNo } = req.body;
      if (!email || !apartmentNo) return res.status(400).send({ message: "Email and apartmentNo are required." });

      const existing = await agreementCollection.findOne({ email, apartmentNo });
      if (existing) return res.status(400).send({ message: "Already applied." });

      const newAgreement = { ...req.body, status: "pending" };
      const result = await agreementCollection.insertOne(newAgreement);
      await usersCollection.updateOne({ email }, { $set: { role: "member" } });

      res.send({ message: "Agreement submitted", insertedId: result.insertedId });
    });

    app.get("/api/agreements", async (req, res) => {
      const email = req.query.email;
      if (!email) return res.status(400).send({ message: "Email required" });
      const agreement = await agreementCollection.findOne({ email });
      if (!agreement) return res.send({});
      res.send(agreement);
    });

    app.patch("/agreements/respond/:id", async (req, res) => {
      const { id } = req.params;
      const { accepted, email } = req.body;
      await agreementCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: "checked" } });
      if (accepted) await usersCollection.updateOne({ email }, { $set: { role: "member" } });
      res.send({ message: "Agreement processed" });
    });

    app.put("/agreements/accept/:id", async (req, res) => {
      const id = new ObjectId(req.params.id);
      const { email } = req.body;
      await agreementCollection.updateOne({ _id: id }, { $set: { status: "checked" } });
      await usersCollection.updateOne({ email }, { $set: { role: "member" } });
      res.send({ message: "Accepted" });
    });

    app.put("/agreements/reject/:id", async (req, res) => {
      const id = new ObjectId(req.params.id);
      await agreementCollection.updateOne({ _id: id }, { $set: { status: "checked" } });
      res.send({ message: "Rejected" });
    });

    // Users
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/role", async (req, res) => {
      const email = req.query.email;
      if (!email) return res.status(400).send({ message: "Email is required" });

      const user = await usersCollection.findOne({ email });
      if (!user) return res.send({ role: "user" }); // default fallback

      res.send({ role: user.role || "user" });
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      if (!user) return res.status(404).send({ message: "User not found" });
      res.send(user);
    });

    app.get("/users", async (req, res) => {
      const roleFilter = req.query.role;
      const query = roleFilter ? { role: roleFilter } : {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.patch("/users/downgrade/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.updateOne({ email }, { $set: { role: "user" } });
      res.send(result);
    });

    // Announcements
    app.post("/announcements", async (req, res) => {
      const { title, description } = req.body;
      if (!title || !description) return res.status(400).send({ message: "Missing title or description" });
      const result = await announcementCollection.insertOne({ title, description, date: new Date() });
      res.send({ message: "Announcement created", result });
    });

    app.get("/announcements", async (req, res) => {
      const announcements = await announcementCollection.find().sort({ date: -1 }).toArray();
      res.send(announcements);
    });

    // Coupons
    app.post("/coupons", async (req, res) => {
      const coupon = req.body;
      const result = await couponsCollection.insertOne(coupon);
      res.send({ message: "Coupon added", result });
    });

    app.get("/coupons", async (req, res) => {
      const result = await couponsCollection.find().toArray();
      res.send(result);
    });

  } catch (err) {
    console.error("Error starting server:", err);
  }

  // payment
  app.get('/api/payments', async (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).send({ message: "Email required" });

    const payments = await paymentsCollection.find({ email }).toArray();
    res.send(payments);
  });

}





run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("BlockWise Server is Running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
