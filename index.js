const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@xenpi.9qo9gbb.mongodb.net/?retryWrites=true&w=majority&appName=XenPi`;
const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

// Collections will be assigned here after connecting
let apartmentCollection, agreementCollection, announcementCollection, usersCollection;

const ADMIN_EMAIL = "admin@gmail.com";

async function run() {
  try {
    await client.connect();

    const db = client.db("Blockwise");
    apartmentCollection = db.collection("apartments");
    agreementCollection = db.collection("agreements");
    announcementCollection = db.collection("announcements");
    usersCollection = db.collection("users");
couponsCollection = db("yourDB").collection("coupons");
    // Apartments route
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

      try {
        const apartments = await apartmentCollection.find(filter).skip(skip).limit(limit).toArray();
        const total = await apartmentCollection.countDocuments(filter);
        res.send({ apartments, total });
      } catch (error) {
        res.status(500).send({ message: "Error fetching apartments", error });
      }
    });

    // Agreements routes
app.post("/agreements", async (req, res) => {
  const { email, apartmentNo } = req.body;

  if (!email || !apartmentNo) {
    return res.status(400).send({ message: "Email and apartmentNo are required." });
  }

  try {
    // Check if agreement already exists
    const existing = await agreementCollection.findOne({ email, apartmentNo });
    if (existing) {
      return res.status(400).send({ message: "You have already applied for this apartment!" });
    }

    // Insert new agreement
    const newAgreement = {
      ...req.body,
      status: "pending",
    };
    const result = await agreementCollection.insertOne(newAgreement);

    // ✅ Update the user's role to "member"
    await usersCollection.updateOne(
      { email },
      { $set: { role: "member" } }
    );

    res.send({ message: "Agreement submitted and user role updated to member!", insertedId: result.insertedId });
  } catch (error) {
    console.error("Agreement error:", error);
    res.status(500).send({ message: "Error submitting agreement", error });
  }
});


    app.get("/agreements/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const agreement = await agreementCollection.findOne({ email });
        res.send(agreement || {});
      } catch (error) {
        res.status(500).send({ message: "Error fetching agreement", error });
      }
    });

    // Users routes
app.post("/users", async (req, res) => {
  const user = req.body;

  if (!user.email) {
    return res.status(400).send({ message: "Email is required" });
  }

  try {
    const existing = await usersCollection.findOne({ email: user.email });

    if (existing) {
      return res.send({ message: "User already exists" });
    }

    // 👇 Role based on email
    let role = "user";
    if (user.email === ADMIN_EMAIL) {
      role = "admin";
    }

    const cleanUser = {
      name: user.name || "No Name",
      email: user.email,
      role: role,
    };

    const result = await usersCollection.insertOne(cleanUser);
    res.send({ message: "User added", result });
  } catch (err) {
    res.status(500).send({ message: "Error creating user", error: err });
  }
});


    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }
        res.send(user);
      } catch (err) {
        res.status(500).send({ message: "Error getting user", error: err });
      }
    });

    // Announcements route
    app.get("/announcements", async (req, res) => {
      try {
        const announcements = await announcementCollection.find().sort({ createdAt: -1 }).toArray();
        res.send(announcements);
      } catch (error) {
        res.status(500).send({ message: "Error fetching announcements", error });
      }
    });

  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

// POST: Create Announcement
app.post("/announcements", async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description) {
    return res.status(400).send({ message: "Title and description are required" });
  }

  try {
    const result = await announcementCollection.insertOne({
      title,
      description,
      date: new Date(),
    });

    res.send({ message: "Announcement created", result });
  } catch (err) {
    res.status(500).send({ message: "Error saving announcement", error: err });
  }
});

// PATCH: Update agreement and user role
app.patch("/agreements/respond/:id", async (req, res) => {
  const { id } = req.params;
  const { accepted, email } = req.body;

  try {
    // 1. Update agreement status
    const updateAgreement = await agreementCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "checked" } }
    );

    // 2. If accepted, update role to member
    let updateUser = null;
    if (accepted) {
      updateUser = await usersCollection.updateOne(
        { email },
        { $set: { role: "member" } }
      );
    }

    res.send({ message: "Agreement processed", updateAgreement, updateUser });
  } catch (err) {
    res.status(500).send({ message: "Error processing agreement", error: err });
  }
});



app.put("/users/remove-member/:email", async (req, res) => {
  const email = req.params.email;
  const result = await usersCollection.updateOne(
    { email },
    { $set: { role: "user" } }
  );
  res.send(result);
});

app.get("/users", async (req, res) => {
  const roleFilter = req.query.role;
  const query = roleFilter ? { role: roleFilter } : {};
  try {
    const users = await usersCollection.find(query).toArray();
    res.send(users);
  } catch (err) {
    res.status(500).send({ message: "Failed to fetch users", error: err });
  }
});

app.patch("/users/downgrade/:email", async (req, res) => {
  const email = req.params.email;
  try {
    const result = await usersCollection.updateOne(
      { email },
      { $set: { role: "user" } }
    );
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Error downgrading user", error: err });
  }
});

app.post("/announcements", async (req, res) => {
  const announcement = req.body;
  const result = await announcementsCollection.insertOne(announcement);
  res.send(result);
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

app.post("/coupons", async (req, res) => {
  const coupon = req.body;
  const result = await couponCollection.insertOne(coupon);
  res.send(result);
});

// Create coupon
app.post("/coupons", async (req, res) => {
  const coupon = req.body;
  try {
    const result = await couponsCollection.insertOne(coupon);
    res.send({ message: "Coupon added", result });
  } catch (err) {
    res.status(500).send({ message: "Error adding coupon", error: err });
  }
});

// Get all coupons
app.get("/coupons", async (req, res) => {
  try {
    const result = await couponsCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Error fetching coupons", error: err });
  }
});


run().catch(console.dir);

// Base route
app.get("/", (req, res) => {
  res.send("BlockWise Server is Running");
});

// Start server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
