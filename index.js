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

async function run() {
  try {
    await client.connect();

    const apartmentCollection = client.db("Blockwise").collection("Apartment");
    const agreementCollection = client.db("Blockwise").collection("agreements");

    // ✅ GET apartments with pagination and rent filter
    app.get("/apartments", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = 6;
      const skip = (page - 1) * limit;

      const min = parseInt(req.query.min) || 0;
      const max = parseInt(req.query.max) || 100000;

      const query = { rent: { $gte: min, $lte: max } };

      try {
        const apartments = await apartmentCollection.find(query).skip(skip).limit(limit).toArray();
        const total = await apartmentCollection.countDocuments(query);
        res.send({ apartments, total });
      } catch (error) {
        res.status(500).send({ message: "Error fetching apartments", error });
      }
    });

    // ✅ POST agreement
    app.post("/agreements", async (req, res) => {
      const { email } = req.body;

      try {
        const existing = await agreementCollection.findOne({ email });
        if (existing) {
          return res.status(400).send({ message: "Already applied for an apartment!" });
        }

        const result = await agreementCollection.insertOne({
          ...req.body,
          status: "pending",
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error submitting agreement", error });
      }
    });

    // ✅ GET agreement by user (optional)
    app.get("/agreements/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const agreement = await agreementCollection.findOne({ email });
        res.send(agreement || {});
      } catch (error) {
        res.status(500).send({ message: "Error fetching agreement", error });
      }
    });

  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

run().catch(console.dir);

// Base Route
app.get("/", (req, res) => {
  res.send("BlockWise Server is Running");
});

// Start Server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

  
