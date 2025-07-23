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

async function run() {
  try {
    await client.connect();

    const db = client.db("Blockwise");
    apartmentCollection = db.collection("apartments");
    agreementCollection = db.collection("agreements");
    announcementCollection = db.collection("announcements");
    usersCollection = db.collection("users");

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
        const existing = await agreementCollection.findOne({ email, apartmentNo });
        if (existing) {
          return res.status(400).send({ message: "You have already applied for this apartment!" });
        }

        const newAgreement = {
          ...req.body,
          status: "pending",
        };

        const result = await agreementCollection.insertOne(newAgreement);
        res.send({ message: "Agreement application submitted successfully!", result });
      } catch (error) {
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

    const cleanUser = {
      name: user.name || "No Name",
      email: user.email,
      role: "user",
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

run().catch(console.dir);

// Base route
app.get("/", (req, res) => {
  res.send("BlockWise Server is Running");
});

// Start server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
