require("dotenv").config();
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

const cors = require("cors");

app.use(cors({ origin: "*" }));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.y9cyf.mongodb.net/?retryWrites=true&w=majority
`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const run = async () => {
  try {
    const db = client.db("blogPost");
    const userCollection = db.collection("user");
    const jobCollection = db.collection("job");
    const messageCollection = db.collection("messages");

    app.post("/user", async (req, res) => {
      const user = req.body;
      console.log(user);
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;

      const result = await userCollection.findOne({ email });

      if (result?.email) {
        return res.send({ status: true, data: result });
      }

      res.send({ status: false });
    });

    app.patch("/apply", async (req, res) => {
      const userId = req.body.userId;
      const jobId = req.body.jobId;
      const email = req.body.email;
      const name = req.body.name;
      const status = req.body.status;
      const appliedDate = req.body.appliedDate;

      const filter = { _id: ObjectId(jobId) };
      const updateDoc = {
        $push: {
          applicants: {
            id: ObjectId(userId),
            email,
            name,
            status,
            appliedDate,
          },
        },
      };

      const result = await jobCollection.updateOne(filter, updateDoc);

      if (result.acknowledged) {
        return res.send({ status: true, data: result });
      }

      res.send({ status: false });
    });

    app.patch("/query", async (req, res) => {
      const userId = req.body.userId;
      const jobId = req.body.jobId;
      const email = req.body.email;
      const question = req.body.question;

      const filter = { _id: ObjectId(jobId) };
      const updateDoc = {
        $push: {
          queries: {
            id: ObjectId(userId),
            email,
            question: question,
            reply: [],
          },
        },
      };

      const result = await jobCollection.updateOne(filter, updateDoc);

      if (result?.acknowledged) {
        return res.send({ status: true, data: result });
      }

      res.send({ status: false });
    });

    app.patch("/reply", async (req, res) => {
      const userId = req.body.userId;
      const reply = req.body.reply;
      const filter = { "queries.id": ObjectId(userId) };

      const updateDoc = {
        $push: {
          "queries.$[user].reply": reply,
        },
      };
      const arrayFilter = {
        arrayFilters: [{ "user.id": ObjectId(userId) }],
      };

      const result = await jobCollection.updateOne(
        filter,
        updateDoc,
        arrayFilter
      );
      if (result.acknowledged) {
        return res.send({ status: true, data: result });
      }

      res.send({ status: false });
    });

    app.get("/applied-jobs/:email", async (req, res) => {
      const email = req.params.email;
      const query = { applicants: { $elemMatch: { email: email } } };
      const cursor = jobCollection.find(query).project({ applicants: 0 });
      const result = await cursor.toArray();

      res.send({ status: true, data: result });
    });

    app.get("/jobs", async (req, res) => {
      const cursor = jobCollection.find({});
      const result = await cursor.toArray();
      res.send({ status: true, data: result });
    });

    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;
      const result = await jobCollection.findOne({ _id: ObjectId(id) });
      res.send({ status: true, data: result });
    });

    app.post("/job", async (req, res) => {
      const job = req.body;
      const result = await jobCollection.insertOne(job);
      res.send({ status: true, data: result });
    });

    app.get("/posted-jobs/:id", async (req, res) => {
      const id = req.params.id;
      const cursor = jobCollection.find({
        userId: id,
      });
      const result = await cursor.toArray();
      res.send({ status: true, data: result });
    });

    app.patch("/close", async (req, res) => {
      const jobId = req.body.jobId;

      const filter = { _id: ObjectId(jobId) };
      const updateDoc = {
        $set: { jobStatus: "closed" },
      };

      const result = await jobCollection.updateOne(filter, updateDoc);
      if (result.acknowledged) {
        return res.send({ status: true, data: result });
      }
      res.send({ status: false });
    });

    app.get("/candidate/:id", async (req, res) => {
      const id = req.params.id;
      const result = await userCollection.findOne({ _id: ObjectId(id) });
      res.send({ status: true, data: result });
    });

    app.patch("/approve", async (req, res) => {
      const id = req.body._id;
      const applicantsId = req.body.id;

      const result = await jobCollection.updateOne(
        { _id: ObjectId(id), "applicants.id": ObjectId(applicantsId) },
        {
          $set: {
            "applicants.$.status": "approved",
          },
        }
      );

      if (result.acknowledged) {
        return res.send({ status: true, data: result });
      }
      res.send({ status: false });
    });

    app.get("/approved-jobs", async (req, res) => {
      const status = req.query.status;
      const email = req.query.email;
      const query = {
        applicants: { $elemMatch: { email: email, status: status } },
      };
      const cursor = jobCollection.find(query).project({ applicants: 0 });
      const result = await cursor.toArray();

      res.send({ status: true, data: result });
    });

    app.get("/searchByDate", async (req, res) => {
      const appliedDate = req.query.appliedDate;
      const email = req.query.email;
      const query = {
        applicants: { $elemMatch: { email: email, appliedDate: appliedDate } },
      };
      const cursor = jobCollection.find(query).project({ applicants: 0 });
      const result = await cursor.toArray();

      res.send({ status: true, data: result });
    });

    app.post("/create-message", async (req, res) => {
      const members = req.body;
      const prev = await messageCollection.findOne({
        members: {
          $all: [
            { $elemMatch: { email: members[0].email } },
            { $elemMatch: { email: members[1].email } },
          ],
        },
      });
      if (prev) {
        prev._id.toString();
        return res.send({ status: true, data: prev });
      }

      const result = await messageCollection.insertOne({
        members,
        conversations: [],
      });
      const messageId = result?.insertedId?.toString();
      res.send({
        status: true,
        data: { _id: messageId, members, conversations: [] },
      });
    });

    app.patch("/send-message", async (req, res) => {
      const { _id, message, author } = req.body;
      const query = { _id: ObjectId(_id) };
      const result = await messageCollection.updateOne(query, {
        $push: { conversations: { message, author } },
      });
      res.send({ status: true, data: result });
    });

    app.get("/message/:email", async (req, res) => {
      const email = req.params.email;
      const query = { members: { $elemMatch: { email } } };
      const data = await messageCollection.find(query).toArray();
      res.send({ status: true, data });
    });

    app.get("/conversation/:id", async (req, res) => {
      const query = { _id: ObjectId(req.params.id) };
      const result = await messageCollection.findOne(query);
      res.send({ status: true, data: result });
    });
  } finally {
  }
};

run().catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example apps listening on port ${port}`);
});
