const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

// middlewares
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true, // Set this to allow credentials (cookies, headers)
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3hdabzk.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // jwt middleware
    const verify = async (req, res, next) => {
      const token = req.cookies?.token;
      if (!token) {
        return res
          .status(401)
          .send({ success: false, message: "Unauthorized" });
      }
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decode) => { 
        if (err) {
          return res.status(403).send(err.message)
        }
        req.decode = decode;
        next();
      })
     
    };

    const database = client.db("chef-vibes-db");

    const categoriesCollection = database.collection("categories");
    const recipieCollection = database.collection("recipies");
    const kitchenCollection = database.collection("kitchen");

    app.post("/jwt", async (req, res) => {
      const body = req.body;
      const token = jwt.sign(body, process.env.ACCESS_TOKEN, {
        expiresIn: "10h",
      });
      console.log(token);
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
          expires: new Date(Date.now() + 10 * 60 * 60 * 1000),
        })
        .send({ success: true, token });
    });

    // Get recipies by category
    app.get("/categories", async (req, res) => {
      try {
        const result = await categoriesCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // Get: ALL Recipies
    app.get("/recipies", verify, async (req, res) => {
      try {
        const projection = {
          strYoutube: 0,
          strTags: 0,
          strInstructions: 0,
        };
        const result = await recipieCollection
          .find()
          .project(projection)
          .toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // Get recipies by category
    app.get("/recipie/:category", async (req, res) => {
      try {
        const foods = await recipieCollection.find({
          strCategory: { $regex: req.params.category, $options: "i" },
        });
        const categoryInfo = await categoriesCollection.findOne({
          strCategory: { $regex: req.params.category, $options: "i" },
        });
        res.send({ categoryInfo, foods });
      } catch (error) {
        console.log(error);
      }
    });

    // Get Recipies by id
    app.get("/recipies/:id", async (req, res) => {
      try {
        const foods = await recipieCollection.findOne({
          _id: new ObjectId(req.params.id),
        });
        res.send(foods);
      } catch (error) {
        console.log(error);
      }
    });

    app.get("/cart",verify, async (req, res) => {
      try {
        const email = req.query?.email;
        if (!email) {
          return res.send([]);
        }
        const result = await kitchenCollection.find({ email }).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    //  post: add recipie
    app.post("/recipie", async (req, res) => {
      try {
        const body = req.body;
        const result = await recipieCollection.insertOne(body);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // post add-to-kitchen
    app.post("/add-to-kitchen",verify, async (req, res) => {
      try {
        const kitchen = req.body;
        const isAdded = await kitchenCollection.findOne({
          recipieId: kitchen.recipieId,
          email: kitchen.email,
        });
        if (isAdded) {
          return res.send({
            acknowledge: true,
            insertedId: isAdded._id,
            status: "Already added",
          });
        }

        const result = await kitchenCollection.insertOne(kitchen);
        res.send({ ...result, status: "added" });
      } catch (error) {
        console.log(error);
      }
    });

    // update method start
    app.put("/recipie/:id",verify, async (req, res) => {
      try {
        const id = { _id: new ObjectId(req.params.id) };
        const body = req.body;
        const updatedData = {
          $set: {
            ...body,
          },
        };
        const options = { upsert: true };
        const result = await recipieCollection.updateOne(
          id,
          updatedData,
          options
        );
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // delete method starts
    //  delete a recipie
    app.delete("/recipie/:id", verify, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await recipieCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    app.delete("/cart/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await kitchenCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("chef vibes is running");
});

app.listen(port, (req, res) => {
  console.log(`The port is running on : ${port}`);
});
