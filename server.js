const express = require("express");
const sql = require("mssql/msnodesqlv8");
const cors = require("cors");
const multer = require("multer");
const app = express();
const nodemailer = require("nodemailer");
// app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// const corsOptions = {
//   origin: 'http://api.lissomtech.in',
//   methods: "GET,POST,PUT,DELETE,PATCH",
//   allowedHeaders: "Content-Type, Authorization"
// };

app.use(cors());

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
};

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "poojachavan081096@gmail.com",
    pass: "quks xmdh uhxe bbkz",
  },
});

sql
  .connect(config)
  .then(() => {
    console.log("Database connected successfully!");
  })
  .catch((error) => {
    console.error("Error connecting to the database:", error);
  });

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Event table where event are stored

app.post("/submit_form", upload.single("file_img"), async (req, res) => {
  const { body, file } = req;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request
      .input("eventName", sql.VarChar, body.eventName)
      .input("eventLocation", sql.VarChar, body.eventLocation)
      .input("eventDate", sql.VarChar, body.eventDate)
      .input("description", sql.VarChar, body.description)
      .input("file_img", sql.VarBinary, file.buffer)
      .input("published", sql.Bit, req.body.published || 0).query(`
          INSERT INTO Tbl_Event
          (EventName, EventLocation, EventDate, Description, Img, Published)
          VALUES
          (@eventName, @eventLocation, @eventDate, @description, @file_img, @published)
      `);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

// fetch event table data in backend table and also  show in website

// app.get('/api/events', async (req, res) => {
//   try {
//     let pool = await sql.connect(config);
//     let result = await pool.request().query('SELECT * FROM Tbl_Event');
//     res.json(result.recordset);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send('Server Error');
//   }
// });

app.get("/api/events", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool.request().query("SELECT * FROM Tbl_Event");

    const events = result.recordset.map((event) => {
      return {
        ...event,
        Img: event.Img
          ? Buffer.from(event.Img, "hex").toString("base64")
          : null,
      };
    });

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// get events by id for edit/update

app.get("/api/events/:EventID", async (req, res) => {
  const eventId = req.params.EventID;

  try {
    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .input("id", sql.Int, eventId)
      .query("SELECT * FROM Tbl_Event WHERE EventID = @id");

    const event = result.recordset[0];

    if (!event) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }

    const eventDetails = {
      EventID: event.EventID,
      EventName: event.EventName,
      EventLocation: event.EventLocation,
      EventDate: event.EventDate,
      Description: event.Description,
      Img: event.Img ? Buffer.from(event.Img, "hex").toString("base64") : null,
    };

    res.json({ success: true, data: [eventDetails] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// save event  header  image in database

app.post("/submit_header", upload.single("file_img"), async (req, res) => {
  const { body, file } = req;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request.input("file_img", sql.VarBinary, file.buffer).query(`
        INSERT INTO Tbl_Header
        (head_Event)
        VALUES
        (@file_img)
      `);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

// get event header from database and show in website to event header

app.get("/api/get_event_header", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .query(
        "SELECT * FROM Tbl_Header WHERE img_id = (SELECT MAX(img_id) FROM Tbl_Header)"
      );

    const seteventheads = result.recordset.map((seteventhead) => {
      return {
        ...seteventhead,
        head_Event: seteventhead.head_Event
          ? Buffer.from(seteventhead.head_Event, "hex").toString("base64")
          : null,
      };
    });

    res.json(seteventheads);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

/// Delete table data from event table

app.delete("/delete_event/:EventID", async (req, res) => {
  const eventId = req.params.EventID;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request
      .input("id", sql.Int, eventId)
      .query("DELETE FROM Tbl_Event WHERE EventID = @id");

    res.json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

// update events

app.put(
  "/update_event/:EventID",
  upload.single("file_img"),
  async (req, res) => {
    const eventId = req.params.EventID;
    const { body, file } = req;

    try {
      await sql.connect(config);
      const request = new sql.Request();
      if (file) {
        await request
          .input("eventName", sql.VarChar, body.eventName)
          .input("eventLocation", sql.VarChar, body.eventLocation)
          .input("eventDate", sql.VarChar, body.eventDate)
          .input("description", sql.VarChar, body.description)
          .input("file_img", sql.VarBinary, file.buffer)
          .input("id", sql.Int, eventId).query(`
                  UPDATE Tbl_Event
                  SET EventName = @eventName,
                      EventLocation = @eventLocation,
                      EventDate = @eventDate,
                      Description = @description,
                      Img = @file_img
                  WHERE EventID = @id
              `);
      } else {
        await request
          .input("eventName", sql.VarChar, body.eventName)
          .input("eventLocation", sql.VarChar, body.eventLocation)
          .input("eventDate", sql.VarChar, body.eventDate)
          .input("description", sql.VarChar, body.description)
          .input("id", sql.Int, eventId).query(`
                  UPDATE Tbl_Event
                  SET EventName = @eventName,
                      EventLocation = @eventLocation,
                      EventDate = @eventDate,
                      Description = @description
                  WHERE EventID = @id
              `);
      }

      res.send({ success: true });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .send({ success: false, message: "Internal Server Error" });
    } finally {
      sql.close();
    }
  }
);

// status change of event publish and unpublish

app.put("/update_publish_status/:EventID", async (req, res) => {
  const eventId = req.params.EventID;
  const { published } = req.body;

  try {
    await sql.connect(config);
    const request = new sql.Request();

    await request
      .input("published", sql.Bit, published)
      .input("id", sql.Int, eventId).query(`
              UPDATE Tbl_Event
              SET Published = @published
              WHERE EventID = @id
          `);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// save aboutus data from backend to databse

// app.post(
//   "/submit_Aboutus_Data",
//   upload.single("aboutImage"),
//   async (req, res) => {
//     const { body, file } = req;

//     try {
//       await sql.connect(config);

//       const request = new sql.Request();
//       await request
//         .input("aboutImage", sql.VarBinary, file.buffer)
//         .input("aboutDescription", sql.VarChar, body.aboutDescription).query(`
//         INSERT INTO Tbl_AboutUs
//         (Aboutus_img, About_Description)
//         VALUES
//         (@aboutImage, @aboutDescription)
//       `);

//       res.send({ success: true });
//     } catch (error) {
//       console.error(error);
//       res
//         .status(500)
//         .send({ success: false, message: "Internal Server Error" });
//     } finally {
//       sql.close();
//     }
//   }
// );

// // get aboutus img from and stoored in header in website

// app.get("/api/getaboutus", async (req, res) => {
//   try {
//     let pool = await sql.connect(config);
//     let result = await pool
//       .request()
//       .query(
//         "SELECT * FROM Tbl_AboutUs WHERE About_Id = (SELECT MAX(About_Id) FROM Tbl_AboutUs)"
//       );

//     const setaboutheads = result.recordset.map((setabouthead) => {
//       return {
//         ...setabouthead,
//         Aboutus_img: setabouthead.Aboutus_img
//           ? Buffer.from(setabouthead.Aboutus_img, "hex").toString("base64")
//           : null,
//       };
//     });

//     res.json(setaboutheads);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Server Error");
//   }
// });

// save fouapp.post(
//   "/submit_Founders_Data",
//   upload.single("founderImage"),
//   async (req, res) => {
//     const { body, file } = req;

//     try {
//       if (!file || !file.buffer) {
//         return res
//           .status(400)
//           .send({ success: false, message: "Invalid file object" });
//       }

//       await sql.connect(config);

//       const request = new sql.Request();
//       await request
//         .input("founderImage", sql.VarBinary, file.buffer)
//         .input("founderName", sql.VarChar, body.founderName)
//         .input("founderRole", sql.VarChar, body.founderRole)
//         .input("founderDescription", sql.VarChar, body.founderDescription)
//         .query(`
//         INSERT INTO Tbl_Foundrs
//         (Founders_img, Founders_Name, Founders_Role, Founders_Description)
//         VALUES
//         (@founderImage, @founderName, @founderRole, @founderDescription)
//       `);

//       res.send({ success: true });
//     } catch (error) {
//       console.error(error);
//       res
//         .status(500)
//         .send({ success: false, message: "Internal Server Error" });
//     } finally {
//       sql.close();
//     }
//   }
// );nders data to databse table :- Tbl_Foundrs

app.get("/api/getaboutus", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .query(
        "SELECT * FROM Tbl_AboutUs WHERE About_Id = (SELECT MAX(About_Id) FROM Tbl_AboutUs)"
      );

    const setaboutheads = result.recordset.map((setabouthead) => {
      return {
        ...setabouthead,
        Aboutus_img: setabouthead.Aboutus_img
          ? Buffer.from(setabouthead.Aboutus_img, "hex").toString("base64")
          : null,
        About_Description: setabouthead.About_Description, // Add this line
      };
    });

    res.json(setaboutheads);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.post(
  "/submit_Aboutus_Data",
  upload.single("aboutImage"),
  async (req, res) => {
    const { body, file } = req;

    try {
      await sql.connect(config);

      const request = new sql.Request();
      await request
        .input("aboutImage", sql.VarBinary, file.buffer)
        .input("aboutDescription", sql.VarChar, body.aboutDescription).query(`
        INSERT INTO Tbl_AboutUs 
        (Aboutus_img, About_Description)
        VALUES
        (@aboutImage, @aboutDescription)
      `);

      res.send({ success: true });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .send({ success: false, message: "Internal Server Error" });
    } finally {
      sql.close();
    }
  }
);

app.get("/about/:About_Id", async (req, res) => {
  const aboutId = req.params.About_Id;

  try {
    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .input("About_Id", sql.Int, aboutId)
      .query(
        "SELECT About_Id, Aboutus_img, About_Description FROM Tbl_AboutUs WHERE About_Id = @About_Id"
      );

    const about = result.recordset[0];

    if (!about) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }

    const aboutDetails = {
      About_Id: about.About_Id,
      Aboutus_img: about.Aboutus_img
        ? Buffer.from(about.Aboutus_img, "hex").toString("base64")
        : null,
      About_Description: about.About_Description,
    };

    res.json({ success: true, data: [aboutDetails] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.delete("/delete-about/:About_Id", async (req, res) => {
  const aboutId = req.params.About_Id;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request
      .input("About_Id", sql.Int, aboutId)
      .query("DELETE FROM Tbl_AboutUs WHERE About_Id = @About_Id");

    res.json({ success: true, message: "about deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

app.put(
  "/update-about/:About_Id",
  upload.single("aboutImage"),
  async (req, res) => {
    const aboutId = req.params.About_Id;
    const { body, file } = req;

    try {
      await sql.connect(config);
      const request = new sql.Request();

      if (file) {
        await request
          .input("aboutDescription", sql.VarChar, body.aboutDescription)
          .input("aboutImage", sql.VarBinary(sql.MAX), file.buffer)
          .input("About_Id", sql.Int, aboutId).query(`
                  UPDATE Tbl_AboutUs
                  SET  
                  About_Description = @aboutDescription,
                  Aboutus_img = @aboutImage
                  WHERE About_Id = @About_Id
              `);
      } else {
        await request
          .input("aboutDescription", sql.VarChar, body.aboutDescription)
          .input("About_Id", sql.Int, aboutId).query(`
                  UPDATE Tbl_AboutUs
                  SET  
                  About_Description = @aboutDescription
                  WHERE About_Id = @About_Id
              `);
      }

      res.send({ success: true });
    } catch (error) {
      console.error(error);

      // Handle the error and send an appropriate response
      res.status(500).send({
        success: false,
        message: "Internal Server Error",
        error: error.message, // Include the error message for debugging
      });
    } finally {
      sql.close();
    }
  }
);

app.post(
  "/submit_Founders_Data",
  upload.single("founderImage"),
  async (req, res) => {
    const { body, file } = req;

    if (!body.founderName || !body.founderRole) {
      return res.status(400).send({
        success: false,
        message: "Founder Name and Role are required fields.",
      });
    }

    try {
      await sql.connect(config);
      const request = new sql.Request();
      await request
        .input("foundersName", sql.VarChar, body.founderName)
        .input("foundersRole", sql.VarChar, body.founderRole)
        .input("description", sql.VarChar, body.founderDescription)
        .input("founderImage", sql.VarBinary, file.buffer).query(`
              INSERT INTO Tbl_Foundrs
              (Founders_Name, Founders_Role, Founders_Description, Founders_img)
              VALUES
              (@foundersName, @foundersRole, @description, @founderImage)
          `);

      res.send({ success: true });
    } catch (error) {
      console.error("Error submitting form:", error);
      res
        .status(500)
        .send({ success: false, message: "Internal Server Error" });
    } finally {
      sql.close();
    }
  }
);

app.get("/Founders/:Founders_Id", async (req, res) => {
  const founderId = req.params.Founders_Id;

  try {
    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .input("Founders_Id", sql.Int, founderId)
      .query("SELECT * FROM Tbl_Foundrs WHERE Founders_Id = @Founders_Id");

    const Founders = result.recordset[0];

    if (!Founders) {
      res.status(404).json({ success: false, message: "Project not found" });
      return;
    }

    const FoundersDetails = {
      Founders_Id: Founders.Founders_Id,
      Founders_Name: Founders.Founders_Name,
      Founders_Role: Founders.Founders_Role,
      Founders_Description: Founders.Founders_Description,
      Founders_img: Founders.Founders_img
        ? Founders.Founders_img.toString("base64")
        : null,
    };

    res.json({ success: true, data: [FoundersDetails] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get("/Founders", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool.request().query("SELECT * FROM  Tbl_Foundrs");

    const Founders = result.recordset.map((Founders) => {
      return {
        ...Founders,
        Founders_img: Founders.Founders_img
          ? Buffer.from(Founders.Founders_img, "hex").toString("base64")
          : null,
      };
    });

    res.json(Founders);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.delete("/delete_Founders/:Founders_Id", async (req, res) => {
  const founderId = req.params.Founders_Id;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request
      .input("Founders_Id", sql.Int, founderId)
      .query("DELETE FROM Tbl_Foundrs WHERE Founders_Id = @Founders_Id");

    res.json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

app.put(
  "/update-Founders/:Founders_Id",
  upload.single("founderImage"),
  async (req, res) => {
    const founderId = req.params.Founders_Id;
    const { body, file } = req;

    try {
      await sql.connect(config);
      const request = new sql.Request();
      if (file && file.buffer) {
        await request
          .input("Foundersname", sql.VarChar, body.founderName)
          .input("Foundersrole", sql.VarChar, body.founderRole)
          .input("Foundersdescription", sql.VarChar, body.founderDescription)
          .input("Founders_img", sql.VarBinary, file.buffer)
          .input("Founders_Id", sql.Int, founderId).query(`
                  UPDATE Tbl_Foundrs
                  SET Founders_Name = @Foundersname,
                      Founders_Role = @Foundersrole,
                      Founders_Description = @Foundersdescription,
                      Founders_img = @Founders_img
                  WHERE Founders_Id = @Founders_Id
              `);
      } else {
        await request
          .input("Foundersname", sql.VarChar, body.founderName)
          .input("Foundersrole", sql.VarChar, body.founderRole)
          .input("Foundersdescription", sql.VarChar, body.founderDescription)
          .input("Founders_Id", sql.Int, founderId).query(`
                  UPDATE Tbl_Foundrs
                  SET Founders_Name = @Foundersname,
                      Founders_Role = @Foundersrole,
                      Founders_Description = @Foundersdescription
                  WHERE Founders_Id = @Founders_Id
              `);
      }

      res.send({ success: true });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .send({ success: false, message: "Internal Server Error" });
    } finally {
      sql.close();
    }
  }
);

// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// add project in databse

// app.post('/submit_projects', upload.single('file_img'), async (req, res) => {
//   const { body, file } = req;

//   try {
//     await sql.connect(config);

//     const request = new sql.Request();
//     await request.input('projectName', sql.NVarChar, body.projectName)
//       .input('projectLocation', sql.NVarChar, body.projectLocation)
//       .input('projectDate', sql.DateTime, body.projectDate)
//       .input('description', sql.NVarChar, body.description)
//       .input('file_img', sql.VarBinary, file.buffer)
//       .query(`
//         INSERT INTO Tbl_Project
//         (Project_Name, Project_location,Project_Date, Project_Description, file_img)
//         VALUES
//         (@projectName, @projectLocation, @projectDate, @description, @file_img)
//       `);

//     res.send({ success: true });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ success: false, message: 'Internal Server Error' });
//   } finally {
//     sql.close();
//   }
// });

// app.post('/submit_projects', upload.single('file_img'), async (req, res) => {
//   const { body, file } = req;

//   try {
//       await sql.connect(config);
//       const request = new sql.Request();

//       if (body.id) {

//           await request
//               .input('id', sql.Int, body.id)
//               .input('projectName', sql.VarChar, body.projectName)
//               .input('projectLocation', sql.VarChar, body.projectLocation)
//               .input('projectDate', sql.VarChar, body.projectDate)
//               .input('description', sql.VarChar, body.description)
//               .input('file_img', sql.VarBinary, file.buffer)
//               .query(`
//                   UPDATE Tbl_Project
//                   SET Project_Name = @projectName,
//                       Project_location = @projectLocation,
//                       Project_Date = @projectDate,
//                       Project_Description = @description,
//                       file_img = @file_img
//                   WHERE id = @id
//               `);
//       } else {
//           await request
//               .input('projectName', sql.VarChar, body.projectName)
//               .input('projectLocation', sql.VarChar, body.projectLocation)
//               .input('projectDate', sql.VarChar, body.projectDate)
//               .input('description', sql.VarChar, body.description)
//               .input('file_img', sql.VarBinary, file.buffer)
//               .query(`
//                   INSERT INTO Tbl_Project
//                   (Project_Name, Project_location, Project_Date, Project_Description, file_img)
//                   VALUES
//                   (@projectName, @projectLocation, @projectDate, @description, @file_img)
//               `);
//       }

//       res.send({ success: true });
//   } catch (error) {
//       console.error(error);
//       res.status(500).send({ success: false, message: 'Internal Server Error' });
//   } finally {
//       sql.close();
//   }
// });

// app.post("/submit_projects", upload.single("file_img"), async (req, res) => {
//   const { body, file } = req;
//   try {
//     await sql.connect(config);
//     const request = new sql.Request();
//     await request
//       .input("projectName", sql.VarChar, body.projectName)
//       .input("projectLocation", sql.VarChar, body.projectLocation)
//       .input("projectDate", sql.VarChar, body.projectDate)
//       .input("description", sql.VarChar, body.description)
//       .input("file_img", sql.VarBinary, file.buffer)
//       .input("published", sql.Bit, req.body.published || 0).query(`
//                   INSERT INTO Tbl_Project
//                   (Project_Name, Project_location, Project_Date, Project_Description, file_img,Published)
//                   VALUES
//                   (@projectName, @projectLocation, @projectDate, @description, @file_img, @published)
//               `);

//     res.send({ success: true });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ success: false, message: "Internal Server Error" });
//   } finally {
//     sql.close();
//   }
// });

//update publish for project

// app.put("/update_publish_status/:id", async (req, res) => {
//   const projectId = req.params.id;
//   const { published } = req.body;

//   try {
//     await sql.connect(config);
//     const request = new sql.Request();

//     await request
//       .input("published", sql.Bit, published)
//       .input("id", sql.Int, projectId).query(`
//               UPDATE Tbl_Project
//               SET Published = @published
//               WHERE id = @id
//           `);

//     res.send({ success: true });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ success: false, message: "Internal Server Error" });
//   } finally {
//     sql.close();
//   }
// });

// get project from database and stored in backend table and also show in website in card format

//--------------------->presentcode--------------------------------------\\

// app.get("/api/projects", async (req, res) => {
//   try {
//     let pool = await sql.connect(config);
//     let result = await pool.request().query("SELECT * FROM  Tbl_Project");

//     const events = result.recordset.map((event) => {
//       return {
//         ...event,
//         file_img: event.file_img
//           ? Buffer.from(event.file_img, "hex").toString("base64")
//           : null,
//       };
//     });

//     res.json(events);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Server Error");
//   }
// });

// app.post("/submit_projects", upload.single("file_img"), async (req, res) => {
//   const { body, file } = req;
//   try {
//     await sql.connect(config);
//     const request = new sql.Request();
//     await request
//       .input("projectName", sql.VarChar, body.projectName)
//       .input("projectLocation", sql.VarChar, body.projectLocation)
//       .input("projectDate", sql.VarChar, body.projectDate)
//       .input("description", sql.VarChar, body.description)
//       .input("file_img", sql.VarBinary, file.buffer)
//       .input("published", sql.Bit, req.body.published || 0).query(`
//                   INSERT INTO Tbl_Project
//                   (Project_Name, Project_location, Project_Date, Project_Description, file_img,Published)
//                   VALUES
//                   (@projectName, @projectLocation, @projectDate, @description, @file_img, @published)
//               `);

//     res.send({ success: true });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ success: false, message: "Internal Server Error" });
//   } finally {
//     sql.close();
//   }
// });

// app.delete("/delete_project/:id", async (req, res) => {
//   const projectId = req.params.id;

//   try {
//     await sql.connect(config);

//     const request = new sql.Request();
//     await request
//       .input("id", sql.Int, projectId)
//       .query("DELETE FROM Tbl_Project WHERE id = @id");

//     res.json({ success: true, message: "Project deleted successfully" });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ success: false, message: "Internal Server Error" });
//   } finally {
//     sql.close();
//   }
// });

// app.get("/projects/:id", async (req, res) => {
//   const projectId = req.params.id;

//   try {
//     let pool = await sql.connect(config);
//     let result = await pool
//       .request()
//       .input("id", sql.Int, projectId)
//       .query("SELECT * FROM Tbl_Project WHERE id = @id");

//     const project = result.recordset[0];

//     if (!project) {
//       res.status(404).json({ success: false, message: "Project not found" });
//       return;
//     }

//     const projectDetails = {
//       id: project.id,
//       Project_Name: project.Project_Name,
//       Project_location: project.Project_location,
//       Project_Date: project.Project_Date,
//       Project_Description: project.Project_Description,
//       file_img: project.file_img
//         ? Buffer.from(project.file_img, "hex").toString("base64")
//         : null,
//     };

//     res.json({ success: true, data: [projectDetails] });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Server Error");
//   }
// });

// app.put("/update-project/:id", upload.single("file_img"), async (req, res) => {
//   const projectId = req.params.id;
//   const { body, file } = req;

//   try {
//     await sql.connect(config);
//     const request = new sql.Request();
//     if (file) {
//       await request
//         .input("projectname", sql.VarChar, body.projectName)
//         .input("projectlocation", sql.VarChar, body.projectLocation)
//         .input("projectdate", sql.VarChar, body.projectDate)
//         .input("projectdescription", sql.VarChar, body.description)
//         .input("file_img", sql.VarBinary, file.buffer)
//         .input("id", sql.Int, projectId).query(`
//                   UPDATE Tbl_Project
//                   SET Project_Name = @projectname,
//                       Project_location = @projectlocation,
//                       Project_Date = @projectdate,
//                       Project_Description = @projectdescription,
//                       file_img = @file_img
//                   WHERE id = @id
//               `);
//     } else {
//       await request
//         .input("projectname", sql.VarChar, body.projectName)
//         .input("projectlocation", sql.VarChar, body.projectLocation)
//         .input("projectdate", sql.VarChar, body.projectDate)
//         .input("projectdescription", sql.VarChar, body.description)
//         .input("id", sql.Int, projectId).query(`
//                   UPDATE Tbl_Project
//                   SET Project_Name = @projectname,
//                       Project_location = @projectlocation,
//                       Project_Date = @projectdate,
//                       Project_Description = @projectdescription
//                   WHERE id = @id
//               `);
//     }

//     res.send({ success: true });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ success: false, message: "Internal Server Error" });
//   } finally {
//     sql.close();
//   }
// });

// app.put("/update-publish-status/:id", async (req, res) => {
//   const projectId = req.params.id;
//   const { published } = req.body;

//   try {
//     await sql.connect(config);
//     const request = new sql.Request();

//     await request
//       .input("published", sql.Bit, published)
//       .input("id", sql.Int, projectId).query(`
//               UPDATE Tbl_Project
//               SET Published = @published
//               WHERE id = @id
//           `);

//     res.send({ success: true });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ success: false, message: "Internal Server Error" });
//   } finally {
//     sql.close();
//   }
// });

//--------------------------------->rashmicode---------------------------------------------\\

app.post("/submit_projects", upload.single("file_img"), async (req, res) => {
  const { body, file } = req;
  try {
    await sql.connect(config);
    const request = new sql.Request();
    const { categories } = req.body;
    if (!categories) {
      return res.status(400).json({ error: "Categories are required." });
    }
    await request
      .input("projectName", sql.VarChar, body.projectName)
      .input("projectLocation", sql.VarChar, body.projectLocation)
      .input("projectDate", sql.VarChar, body.projectDate)
      .input("description", sql.VarChar, body.description)
      .input("file_img", sql.VarBinary, file.buffer)
      .input("categories", sql.VarChar, body.categories)
      .input("published", sql.Bit, req.body.published || 0).query(`
                  INSERT INTO Tbl_Project
                  (Project_Name, Project_location, Project_Date, Project_Description, file_img,Published,categories)
                  VALUES
                  (@projectName, @projectLocation, @projectDate, @description, @file_img, @published,@categories)
              `);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

app.get("/projects", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool.request().query("SELECT * FROM  Tbl_Project");

    const projects = result.recordset.map((project) => {
      return {
        ...project,
        file_img: project.file_img
          ? Buffer.from(project.file_img, "hex").toString("base64")
          : null,
        categories: project.categories,
      };
    });

    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.delete("/delete_project/:id", async (req, res) => {
  const projectId = req.params.id;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request
      .input("id", sql.Int, projectId)
      .query("DELETE FROM Tbl_Project WHERE id = @id");

    res.json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

app.get("/projects/:id", async (req, res) => {
  const projectId = req.params.id;

  try {
    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .input("id", sql.Int, projectId)
      .query("SELECT * FROM Tbl_Project WHERE id = @id");

    const project = result.recordset[0];

    if (!project) {
      res.status(404).json({ success: false, message: "Project not found" });
      return;
    }

    const projectDetails = {
      id: project.id,
      Project_Name: project.Project_Name,
      Project_location: project.Project_location,
      Project_Date: project.Project_Date,
      Project_Description: project.Project_Description,
      categories: project.categories,
      file_img: project.file_img
        ? Buffer.from(project.file_img, "hex").toString("base64")
        : null,
    };

    res.json({ success: true, data: [projectDetails] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.put("/update-project/:id", upload.single("file_img"), async (req, res) => {
  const projectId = req.params.id;
  const { body, file } = req;

  try {
    await sql.connect(config);
    const request = new sql.Request();
    if (file) {
      await request
        .input("projectname", sql.VarChar, body.projectName)
        .input("projectlocation", sql.VarChar, body.projectLocation)
        .input("projectdate", sql.VarChar, body.projectDate)
        .input("projectdescription", sql.VarChar, body.description)
        .input("categories", sql.VarChar, body.categories)
        .input("file_img", sql.VarBinary, file.buffer)
        .input("id", sql.Int, projectId).query(`
                  UPDATE Tbl_Project
                  SET Project_Name = @projectname,
                      Project_location = @projectlocation,
                      Project_Date = @projectdate,
                      Project_Description = @projectdescription,
                      file_img = @file_img,
                      categories=@categories
                  WHERE id = @id
              `);
    } else {
      await request
        .input("projectname", sql.VarChar, body.projectName)
        .input("projectlocation", sql.VarChar, body.projectLocation)
        .input("projectdate", sql.VarChar, body.projectDate)
        .input("projectdescription", sql.VarChar, body.description)
        .input("categories", sql.VarChar, body.categories)
        .input("id", sql.Int, projectId).query(`
                  UPDATE Tbl_Project
                  SET Project_Name = @projectname,
                      Project_location = @projectlocation,
                      Project_Date = @projectdate,
                      Project_Description = @projectdescription,
                      categories=@categories
                  WHERE id = @id
              `);
    }

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

app.put("/update-publish-status/:id", async (req, res) => {
  const projectId = req.params.id;
  const { published } = req.body;

  try {
    await sql.connect(config);
    const request = new sql.Request();

    await request
      .input("published", sql.Bit, published)
      .input("id", sql.Int, projectId).query(`
              UPDATE Tbl_Project
              SET Published = @published
              WHERE id = @id
          `);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// save Home data to databse table :- Tbl_home

app.post("/submitHomedata", upload.single("file_video"), async (req, res) => {
  const { body, file } = req;

  try {
    if (!file || !file.buffer) {
      return res
        .status(400)
        .send({ success: false, message: "Invalid file object" });
    }

    await sql.connect(config);

    const request = new sql.Request();
    await request
      .input("file_video", sql.VarBinary, file.buffer)
      .input("aboutProject", sql.VarChar, body.aboutProject)
      .input("whoWeAre", sql.VarChar, body.whoWeAre)
      .input("ourMission", sql.VarChar, body.ourMission)
      .input("ourVision", sql.VarChar, body.ourVision)
      .input("experties", sql.VarChar, body.experties)
      .input("quality", sql.VarChar, body.quality)
      .input("clientApproch", sql.VarChar, body.clientApproch)
      .input("timelyDelivery", sql.VarChar, body.timelyDelivery).query(`
      INSERT INTO Tbl_Home 
      (Video, aboutProject, whoWeAre, ourMission, ourVision, experties, quality, clientApproch, timelyDelivery)
      VALUES
      (@file_video, @aboutProject, @whoWeAre, @ourMission, @ourVision, @experties, @quality, @clientApproch, @timelyDelivery)
      
      `);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

app.get("/homeData", async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query(
      "SELECT * FROM Tbl_Home WHERE id = (SELECT MAX(id) FROM Tbl_Home)"
    );
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

app.get("/homedatato", async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query("SELECT * FROM Tbl_Home ");
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});





///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// // save Services we offer  data to databse table :- Tbl_services

// app.post(
//   "/submit_Services_Data",
//   upload.single("aboutImage"),
//   async (req, res) => {
//     const { body, file } = req;

//     try {
//       await sql.connect(config);

//       const request = new sql.Request();
//       await request
//         .input("aboutImage", sql.VarBinary, file.buffer)
//         .input("aboutDescription", sql.VarChar, body.aboutDescription).query(`
//         INSERT INTO Tbl_services
//         (Service_img, Service_Name)
//         VALUES
//         (@aboutImage, @aboutDescription)
//       `);

//       res.send({ success: true });
//     } catch (error) {
//       console.error(error);
//       res
//         .status(500)
//         .send({ success: false, message: "Internal Server Error" });
//     } finally {
//       sql.close();
//     }
//   }
// );

// get services from tbl and show in website

// app.get("/api/getservices", async (req, res) => {
//   try {
//     let pool = await sql.connect(config);
//     let result = await pool.request().query("SELECT * FROM Tbl_services");

//     const gallerys = result.recordset.map((services) => {
//       return {
//         ...services,
//         Service_img: services.Service_img
//           ? Buffer.from(services.Service_img, "hex").toString("base64")
//           : null,
//       };
//     });

//     res.json(gallerys);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Server Error");
//   }
// });

app.post(
  "/submit_Services_Data",
  upload.single("serviceImage"),
  async (req, res) => {
    const { body, file } = req;

    try {
      await sql.connect(config);

      const request = new sql.Request();
      await request
        .input("aboutImage", sql.VarBinary, file.buffer)
        .input("aboutDescription", sql.VarChar, body.serviceName).query(`
          INSERT INTO Tbl_services 
          (Service_img, Service_Name)
          VALUES
          (@aboutImage, @aboutDescription)
        `);

      res.send({ success: true });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .send({ success: false, message: "Internal Server Error" });
    } finally {
      sql.close();
    }
  }
);

app.get("/api/getservices", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool.request().query("SELECT * FROM Tbl_services");

    const gallerys = result.recordset.map((services) => {
      return {
        ...services,
        Service_img: services.Service_img
          ? Buffer.from(services.Service_img, "hex").toString("base64")
          : null,
      };
    });

    res.json(gallerys);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get("/test/:id", async (req, res) => {
  const ServiceID = req.params.id;

  try {
    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .input("id", sql.Int, ServiceID)
      .query("SELECT * FROM Tbl_services WHERE id = @id");

    const test = result.recordset[0];

    if (!test) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }

    const testDetails = {
      id: test.id,
      Service_Name: test.Service_Name,

      Service_img: test.Service_img
        ? Buffer.from(test.Service_img, "hex").toString("base64")
        : null,
    };

    res.json({ success: true, data: [testDetails] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.delete("/delete-test/:id", async (req, res) => {
  const ServiceID = req.params.id;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request
      .input("id", sql.Int, ServiceID)
      .query("DELETE FROM Tbl_services WHERE id = @id");

    res.json({ success: true, message: "test deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

app.put("/update-test/:id", upload.single("serviceImage"), async (req, res) => {
  const ServiceID = req.params.id;
  const { body, file } = req;

  try {
    await sql.connect(config);
    const request = new sql.Request();

    if (file) {
      // If image is provided, update both name and image
      await request
        .input("serviceName", sql.VarChar, body.serviceName)
        .input("serviceImage", sql.VarBinary, file.buffer)
        .input("id", sql.Int, ServiceID).query(`
                    UPDATE Tbl_services
                    SET Service_Name = @serviceName,
                    Service_img = @serviceImage
                    WHERE id = @id
                `);
    } else {
      // If no image is provided, update only the name
      await request
        .input("serviceName", sql.VarChar, body.serviceName)
        .input("id", sql.Int, ServiceID).query(`
                    UPDATE Tbl_services
                    SET Service_Name = @serviceName
                    WHERE id = @id
                `);
    }

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// // save Gallery  to databse table :- Tbl_gallery

app.post("/submit_gallery", upload.single("file_img"), async (req, res) => {
  const { body, file } = req;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request.input("file_img", sql.VarBinary, file.buffer).query(`
        INSERT INTO Tbl_Gallery
        (Allimg)
        VALUES
        (@file_img)
      `);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

// get from gallery tbl and show into website

app.get("/api/getimg", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool.request().query("SELECT * FROM Tbl_Gallery");

    const gallerys = result.recordset.map((gallery) => {
      return {
        ...gallery,
        Allimg: gallery.Allimg
          ? Buffer.from(gallery.Allimg, "hex").toString("base64")
          : null,
      };
    });

    res.json(gallerys);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// save gallery head to database

app.post(
  "/submit_gallery_head",
  upload.single("headerimg"),
  async (req, res) => {
    const { body, file } = req;

    try {
      await sql.connect(config);

      const request = new sql.Request();
      await request.input("headerimg", sql.VarBinary, file.buffer).query(`
        INSERT INTO Tbl_Galleryhead
        (head_Gallery)
        VALUES
        (@headerimg)
      `);

      res.send({ success: true });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .send({ success: false, message: "Internal Server Error" });
    } finally {
      sql.close();
    }
  }
);

// get gallery head image and show website

app.get("/api/get_header_img", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .query(
        "SELECT * FROM Tbl_Galleryhead WHERE id = (SELECT MAX(id) FROM Tbl_Galleryhead)"
      );

    const galleryheads = result.recordset.map((galleryhead) => {
      return {
        ...galleryhead,
        head_Gallery: galleryhead.head_Gallery
          ? Buffer.from(galleryhead.head_Gallery, "hex").toString("base64")
          : null,
      };
    });

    res.json(galleryheads);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.post("/saveData", upload.single("image"), async (req, res) => {
  try {
    const { categories } = req.body;
    const image = req.file ? req.file.buffer.toString("hex") : null;

    if (!categories) {
      return res.status(400).json({ error: "Categories are required." });
    }

    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("image", sql.VarChar, image)
      .input("categories", sql.VarChar, categories)
      .query(
        "INSERT INTO Tbl_gallerys (ImageColumn, CategoriesColumn) VALUES (@image, @categories)"
      );

    res
      .status(200)
      .json({ success: true, message: "Data saved successfully." });
  } catch (error) {
    console.error("Error saving data to the database:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.delete("/deleteImage/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Image ID is required." });
    }

    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM Tbl_gallerys WHERE ID = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Image not found." });
    }

    res
      .status(200)
      .json({ success: true, message: "Image deleted successfully." });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/getGalleryData", async (req, res) => {
  try {
    const pool = await sql.connect(config);

    const result = await pool.request().query("SELECT * FROM Tbl_gallerys");

    const galleryData = result.recordset.map((data) => {
      const imageBuffer = Buffer.from(data.ImageColumn, "hex");

      return {
        id: data.ID, // Include the id in the response
        image: imageBuffer.toString("base64"),
        categories: data.CategoriesColumn,
      };
    });

    res.status(200).json(galleryData);
  } catch (error) {
    console.error("Error fetching gallery data:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// save careerbackend data in career table

app.post("/submit_Career_Data", upload.single("images"), async (req, res) => {
  const { body, file } = req;

  try {
    if (!file || !file.buffer) {
      return res
        .status(400)
        .send({ success: false, message: "Invalid file object" });
    }

    await sql.connect(config);

    const request = new sql.Request();
    await request
      .input("images", sql.VarBinary, file.buffer)

      .input("openings", sql.VarChar, body.openings).query(`
        INSERT INTO Tbl_Careersbackend 
        (image, Openings)
        VALUES
        (@images, @openings)
      `);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

// get career head from tbl and show into  website

app.get("/api/career_head_img", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .query(
        "SELECT * FROM Tbl_Careersbackend WHERE id = (SELECT MAX(id) FROM Tbl_Careersbackend)"
      );

    const getcareerheads = result.recordset.map((getcareerhead) => {
      return {
        ...getcareerhead,
        Image: getcareerhead.Image
          ? Buffer.from(getcareerhead.Image, "hex").toString("base64")
          : null,
      };
    });

    res.json(getcareerheads);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// save contactusbackend data in contactusbackend table

app.post(
  "/submit_Contactusback_Data",
  upload.single("images"),
  async (req, res) => {
    const { body, file } = req;

    try {
      if (!file || !file.buffer) {
        return res
          .status(400)
          .send({ success: false, message: "Invalid file object" });
      }

      await sql.connect(config);

      const request = new sql.Request();
      await request
        .input("images", sql.VarBinary, file.buffer)
        .input("address1", sql.VarChar, body.address1)
        .input("email", sql.VarChar, body.email)
        .input("contact", sql.VarChar, body.contact).query(`
        INSERT INTO Tbl_Contactusbackend 
        (image, Address, Email, Contact)
        VALUES
        (@images, @address1, @email, @contact)
    `);

      res.send({ success: true });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .send({ success: false, message: "Internal Server Error" });
    } finally {
      sql.close();
    }
  }
);

// get contactus head from tbl and show into  website

app.get("/api/contactus_head", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .query(
        "SELECT * FROM Tbl_Contactusbackend WHERE id = (SELECT MAX(id) FROM Tbl_Contactusbackend)"
      );

    const getheads = result.recordset.map((gethead) => {
      return {
        ...gethead,
        Image: gethead.Image
          ? Buffer.from(gethead.Image, "hex").toString("base64")
          : null,
      };
    });

    res.json(getheads);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// get contactus data
app.get("/api/contactus_back", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .query("SELECT * FROM Tbl_Contactusbackend ");

    const getheads = result.recordset.map((gethead) => {
      return {
        ...gethead,
        Image: gethead.Image
          ? Buffer.from(gethead.Image, "hex").toString("base64")
          : null,
      };
    });

    res.json(getheads);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// save logo to database

app.post("/save_logo", upload.single("file_img"), async (req, res) => {
  const { body, file } = req;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request.input("file_img", sql.VarBinary, file.buffer).query(`
        INSERT INTO Tbl_Logo
        (logo)
        VALUES
        (@file_img)
      `);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

// get logo from databse

app.get("/api/getlogo", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    // let result = await pool.request().query('SELECT * FROM Tbl_logo');
    let result = await pool
      .request()
      .query(
        "SELECT * FROM Tbl_logo WHERE id = (SELECT MAX(id) FROM Tbl_logo)"
      );
    const setlogos = result.recordset.map((setlogo) => {
      return {
        ...setlogo,
        logo: setlogo.logo
          ? Buffer.from(setlogo.logo, "hex").toString("base64")
          : null,
      };
    });

    res.json(setlogos);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get("/api/getlogos", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    // let result = await pool.request().query('SELECT * FROM Tbl_logo');
    let result = await pool.request().query("SELECT * FROM Tbl_logo ");
    const setlogos = result.recordset.map((setlogo) => {
      return {
        ...setlogo,
        logo: setlogo.logo
          ? Buffer.from(setlogo.logo, "hex").toString("base64")
          : null,
      };
    });

    res.json(setlogos);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

//delete logo  from table

// Delete logo from database

app.delete("/api/deletelogo/:id", async (req, res) => {
  const logoId = req.params.id;

  try {
    let pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("id", sql.Int, logoId)
      .query("DELETE FROM Tbl_Logo WHERE id = @id");

    if (result.rowsAffected[0] > 0) {
      res.send({ success: true, message: "Logo deleted successfully" });
    } else {
      res.status(404).send({ success: false, message: "Logo not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//save  testimonial section to database

app.post("/add_testimonial", async (req, res) => {
  const { body } = req;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request
      .input("clientName", sql.NVarChar, body.clientName)
      .input("clientPosition", sql.NVarChar, body.clientPosition)
      .input("address", sql.NVarChar, body.address)
      .input("comment", sql.NVarChar, body.comment).query(`
        INSERT INTO Tbl_Testimonial 
        (Client_name, Client_position, Address, Comment)
        VALUES
        (@clientName, @clientPosition, @address, @comment)
      `);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

// get values from testimonial

app.get("/get_testimonials", async (req, res) => {
  try {
    await sql.connect(config);

    const request = new sql.Request();
    const result = await request.query("SELECT * FROM Tbl_Testimonial");

    res.send(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

app.get("/testimonial/:Id", async (req, res) => {
  const testId = req.params.Id;

  try {
    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .input("id", sql.Int, testId)
      .query("SELECT * FROM Tbl_Testimonial WHERE Id = @id");

    const test = result.recordset[0];

    if (!test) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }

    const testDetails = {
      Id: test.Id,
      Client_name: test.Client_name,
      Client_position: test.Client_position,
      Address: test.Address,
      Comment: test.Comment,
      Img: test.Img ? Buffer.from(test.Img, "hex").toString("base64") : null,
    };

    res.json({ success: true, data: [testDetails] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});
app.delete("/delete-testimonial/:Id", async (req, res) => {
  const testId = req.params.Id;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request
      .input("id", sql.Int, testId)
      .query("DELETE FROM Tbl_Testimonial WHERE Id = @id");

    res.json({ success: true, message: "test deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});
app.put("/update-testimonial/:Id", async (req, res) => {
  const testId = req.params.Id;
  const { body } = req;

  try {
    await sql.connect(config);
    const request = new sql.Request();

    if (!body.clientName) {
      return res
        .status(400)
        .json({ success: false, message: "Client Name is required" });
    }

    await request
      .input("clientName", sql.VarChar, body.clientName)
      .input("clientPosition", sql.VarChar, body.clientPosition)
      .input("address", sql.VarChar, body.address)
      .input("comment", sql.VarChar, body.comment)
      .input("id", sql.Int, testId).query(`
              UPDATE Tbl_Testimonial
              SET Client_name = @clientName,
                  Client_position = @clientPosition,
                  Address = @address,
                  Comment = @comment
              WHERE Id = @id
          `);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// User login ...................................

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, password)
      .query(
        "SELECT * FROM Tbl_Users WHERE Email = @email AND Password = @password"
      );

    if (result.recordset.length > 0) {
      // Successful login
      res.sendStatus(200);
    } else {
      // Login failed
      res.sendStatus(401);
    }
  } catch (error) {
    console.error("Database error:", error);
    res.sendStatus(500);
  }
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// save our clients img to database table

app.post("/save_ourclients", upload.single("file_img"), async (req, res) => {
  const { body, file } = req;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request.input("file_img", sql.VarBinary, file.buffer).query(`
        INSERT INTO Tbl_Ourclients
        (Ourclients)
        VALUES
        (@file_img)
      `);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

//get clients

app.get("/api/getclients", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool.request().query("SELECT * FROM Tbl_Ourclients");
    const setclients = result.recordset.map((setclient) => {
      return {
        ...setclient,
        Ourclients: setclient.Ourclients
          ? Buffer.from(setclient.Ourclients, "hex").toString("base64")
          : null,
      };
    });

    res.json(setclients);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

//delete clients

app.delete("/delete-client/:id", async (req, res) => {
  const clientId = req.params.id;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request
      .input("id", sql.Int, clientId)
      .query("DELETE FROM Tbl_Ourclients WHERE id = @id");

    res.json({ success: true, message: "event deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// get tender values from tender table

app.get("/get_tender", async (req, res) => {
  try {
    await sql.connect(config);

    const request = new sql.Request();
    const result = await request.query("SELECT * FROM Tbl_Tender");

    res.send(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.get("/api/tenders", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query("SELECT * FROM Tbl_Tender");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.put("/api/tenders/:tenderNo", async (req, res) => {
  const { tenderNo } = req.params;
  const { publish } = req.body;

  try {
    const pool = await sql.connect(config);
    const query = `UPDATE Tbl_Tender SET Publish = @publish WHERE TenderNo = @tenderNo`;

    const result = await pool
      .request()
      .input("publish", sql.Bit, publish)
      .input("tenderNo", sql.NVarChar, tenderNo)
      .query(query);

    res
      .status(200)
      .json({ success: true, message: "Publish status updated successfully." });
  } catch (error) {
    console.error("Error updating publish status:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/api/tenders/published", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const query = "SELECT * FROM Tbl_Tender WHERE Publish = 1";
    const result = await pool.request().query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching published tenders:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.delete("/api/tenders/:tenderNo", async (req, res) => {
  const { tenderNo } = req.params;

  try {
    const pool = await sql.connect(config);
    const query = "DELETE FROM Tbl_Tender WHERE TenderNo = @tenderNo";

    const result = await pool
      .request()
      .input("tenderNo", sql.NVarChar, tenderNo)
      .query(query);

    if (result.rowsAffected[0] > 0) {
      res
        .status(200)
        .json({ success: true, message: "Tender deleted successfully." });
    } else {
      res.status(404).json({ success: false, message: "Tender not found." });
    }
  } catch (error) {
    console.error("Error deleting tender:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/get_tender/:tenderNo", async (req, res) => {
  const tenderNo = req.params.tenderNo;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    const result = await request
      .input("tenderNo", sql.NVarChar, tenderNo)
      .query(`SELECT * FROM Tbl_Tender WHERE TenderNo = @tenderNo`);

    if (result.recordset.length > 0) {
      res.send(result.recordset[0]);
    } else {
      res.status(404).send({
        success: false,
        message: `Tender with TenderNo ${tenderNo} not found`,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// save new user signup

app.post("/login/userlogin", async (req, res) => {
  const { email, password } = req.body;
  const { body } = req;
  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request.query(`
          INSERT INTO Tbl_Users (Email, Password)
          VALUES ('${email}', '${password}')
      `);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// here is all form data api where form data stored in databse

// enquiry form data saved in database table :- Tbl_EnquiryForm

app.post("/enquiryform/submitForm", async (req, res) => {
  const { name, email, phone, address, message } = req.body;
  const { body } = req;
  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request.query(`
          INSERT INTO Tbl_EnquiryForm (name, email, contactnumber, address, message)
          VALUES ('${name}', '${email}', '${phone}', '${address}', '${message}')
      `);

    // Send thank-you email to customer
    const customerMailOptions = {
      from: "poojachavan081096@gmail.com",
      to: body.email, // Use the customer's email address from the form
      subject: "Thank you for contacting us",
      text: `Dear  ${body.name},

  Thank you for your recent inquiry.  and we are excited to assist you.
  
  Please be assured that your inquiry has been received, and our team is working to provide you with a timely and accurate response. We understand the importance of your inquiry and are  committed to delivering exceptional customer service.
  
  We will respond to your inquiry as soon as possible, typically within 24 Hours. In the meantime, please feel free to contact us if you have any further questions or concerns.
  
  Once again, thank you for your inquiry. We look forward to the opportunity to serve you.
  
  Best regards,
  
  Matoshree Interiors`,
    };

    // Send new form submitted email to vendor
    const vendorMailOptions = {
      from: "poojachavan081096@gmail.com",
      to: "poojachavan081096@gmail.com", // Replace with vendor's email
      subject: "New form submitted",
      text: `A new form has been submitted with the following details:\n\nName: ${body.name}\nEmail: ${body.email}\nPhone: ${body.phone}\nMessage: ${body.message}\naddress:${body.address}`,
    };

    await transporter.sendMail(customerMailOptions);
    await transporter.sendMail(vendorMailOptions);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//// Contact us form data saved in database table :- Tbl_ContactUs

app.post("/contactus/submitForm", async (req, res) => {
  const { name, email, phone, message } = req.body;
  const { body } = req;
  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request.query(`
          INSERT INTO Tbl_ContactUs (name, email, phone, message)
          VALUES ('${name}', '${email}', '${phone}', '${message}')
      `);

    // Send thank-you email to customer
    const customerMailOptions = {
      from: "poojachavan081096@gmail.com",
      to: body.email, // Use the customer's email address from the form
      subject: "Thank you for contacting us",
      text: `Thank you for getting in touch! We appreciate you contacting us. One of our colleagues will get back in touch with you soon!Have a great day!`,
    };

    // Send new form submitted email to vendor
    const vendorMailOptions = {
      from: "poojachavan081096@gmail.com",
      to: "poojachavan081096@gmail.com", // Replace with vendor's email
      subject: "New form submitted",
      text: `A new form has been submitted with the following details:\n\nName: ${body.name}\nEmail: ${body.email}\nPhone: ${body.phone}\nMessage: ${body.comment}`,
    };

    await transporter.sendMail(customerMailOptions);
    await transporter.sendMail(vendorMailOptions);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

////Career form data saved in database table :- Tbl_Careers

app.post("/careers/submitForm", upload.single("resume"), async (req, res) => {
  const { body, file } = req;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request
      .input("firstName", sql.VarChar, body.firstName)
      .input("middleName", sql.VarChar, body.middleName)
      .input("lastName", sql.VarChar, body.lastName)
      .input("email", sql.VarChar, body.email)
      .input("phoneNumber", sql.VarChar, body.phoneNumber)
      .input("selectedPost", sql.VarChar, body.selectedPost)
      .input("currentLocation", sql.VarChar, body.currentLocation)
      .input("currentEmployer", sql.VarChar, body.currentEmployer)
      .input("experience", sql.VarChar, body.experience)
      .input("qualification", sql.VarChar, body.qualification)
      .input("resume", sql.VarBinary, file.buffer).query(`
      INSERT INTO Tbl_Careers 
      (FirstName, MiddleName, LastName, Email, MobileNumber, AppliedPost, CurrentLocation, CurrentEmployer, Experience, Qualification, Resume)
      VALUES
      (@firstName, @middleName, @lastName, @email, @phoneNumber, @selectedPost, @currentLocation, @currentEmployer, @experience, @qualification, @resume)
    `);

    // Send thank-you email to customer
    const customerMailOptions = {
      from: "poojachavan081096@gmail.com",
      to: req.body.email, // Use the customer's email address from the form
      subject: "Thank you for contacting us",
      text: "Thank you for filling out your information!Weve sent you an email with  the email address you provided. Please enjoy, and let us know if theres anything else we can help you with.The Matoshree Team",
    };

    // Send new form submitted email to vendor
    const vendorMailOptions = {
      from: "poojachavan081096@gmail.com",
      to: "poojachavan081096@gmail.com", // Replace with vendor's email
      subject: "New form submitted",
      text: `A new form has been submitted with the following details:\n\n +
          First Name: ${req.body.firstName}\n 
          Middle Name: ${req.body.middleName}\n 
          Last Name: ${req.body.lastName}\n 
          Email: ${req.body.email}\n 
          Phone: ${req.body.phone}\n 
          Selected Post: ${req.body.selectedPost}\n 
          Current Location: ${req.body.currentLocation}\n 
          Current Employer: ${req.body.currentEmployer}\n 
          Experience: ${req.body.experience}\n 
          Qualification: ${req.body.qualification}\n,
          Resume: [Attached],`,

      attachments: [
        {
          filename: "resume.pdf",
          content: req.file.buffer,
        },
      ],
    };

    await transporter.sendMail(customerMailOptions);
    await transporter.sendMail(vendorMailOptions);

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// here is hr policies come from database Table :- Tbl_hrpolicies

const connectionPromise = sql.connect(config);

app.get("/api/hrpolicies", async (req, res) => {
  try {
    const connection = await connectionPromise;
    const request = new sql.Request(connection);
    const result = await request.query("SELECT message FROM Tbl_hrpolicies");

    if (result.recordset.length > 0) {
      res.json({ message: result.recordset[0].message });
    } else {
      res.status(404).send("No policy message found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});




app.delete("/delete-home/:id", async (req, res) => {
  const homeId = req.params.id;
  console.log("Deleting home with ID:", homeId); // Add this line for debugging


  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request
      .input("id", sql.Int, homeId)
      .query("DELETE FROM Tbl_Home WHERE id = @id");

    res.json({ success: true, message: "test deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});


// save contactusbackend data in contactusbackend table

// save contactusbackend data in contactusbackend table

app.get("/api/contacts", async (req, res) => {
  try {
    let pool = await sql.connect(config);
    let result = await pool.request().query("SELECT * FROM Tbl_Contactusbackend");

    const events = result.recordset.map((event) => {
      return {
        ...event,
        Image: event.Image
          ? Buffer.from(event.Image, "hex").toString("base64")
          : null,
      };
    });

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get("/api/contacts/:id", async (req, res) => {
  const id = req.params.id;

  try {
    let pool = await sql.connect(config);
    let result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM Tbl_Contactusbackend WHERE id = @id");

    const event = result.recordset[0];

    if (!event) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }

    const eventDetails = {
      id: event.id,
      Address: event.Address,
      Header: event.Header,
      Contact: event.Contact,
      Email: event.Email,
      Image: event.Image ? Buffer.from(event.Image, "hex").toString("base64") : null,
    };

    res.json({ success: true, data: [eventDetails] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.delete("/delete_contacts/:id", async (req, res) => {
  const id = req.params.id;

  try {
    await sql.connect(config);

    const request = new sql.Request();
    await request
      .input("id", sql.Int, id)
      .query("DELETE FROM [Tbl_Contactusbackend] WHERE id = @id");

    res.json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  } finally {
    sql.close();
  }
});
app.post(
  "/submit_Contactusback_Data",
  upload.single("images"),
  async (req, res) => {
    const { body, file } = req;

    try {
      if (!file || !file.buffer) {
        return res
          .status(400)
          .send({ success: false, message: "Invalid file object" });
      }

      await sql.connect(config);

      const request = new sql.Request();
      await request
      .input("header",sql.VarChar,body.header)
        .input("images", sql.VarBinary, file.buffer)
        .input("address1", sql.VarChar, body.address1)
        .input("email", sql.VarChar, body.email)
        .input("contact", sql.VarChar, body.contact).query(`
        INSERT INTO Tbl_Contactusbackend 
        (image, Address, Email, Contact,Header)
        VALUES
        (@images, @address1, @email, @contact,@header)
    `);

      res.send({ success: true });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .send({ success: false, message: "Internal Server Error" });
    } finally {
      sql.close();
    }
  }
);

app.put(
  "/update_contacts/:id",
  upload.single("Image"),
  async (req, res) => {
    const id = req.params.id;
    const { body, file } = req;

    try {
      await sql.connect(config);
      const request = new sql.Request();
      if (file) {
        await request
        .input("header",sql.VarChar,body.header)
        .input("images", sql.VarBinary, file.buffer)
        .input("address1", sql.VarChar, body.address1)
        .input("email", sql.VarChar, body.email)
        .input("contact", sql.VarChar, body.contact)
          .input("id", sql.Int, id).query(`
                  UPDATE Tbl_Contactusbackend
                  SET Header = @header,
                      Contact = @contact,
                      Address = @address1,
                      Email = @email,
                      Image = @images
                  WHERE id = @id
              `);
      } else {
        await request
        .input("header",sql.VarChar,body.header)
        .input("address1", sql.VarChar, body.address1)
        .input("email", sql.VarChar, body.email)
        .input("contact", sql.VarChar, body.contact)
          .input("id", sql.Int, id).query(`
                  UPDATE Tbl_Contactusbackend
                  SET Header = @header,
                      Contact = @contact,
                      Address = @address1,
                      Email = @email
                  
                  WHERE id = @id
              `);
      }

      res.send({ success: true });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .send({ success: false, message: "Internal Server Error" });
    } finally {
      sql.close();
    }
  }
);

// app.options("api/login", cors());

const PORT = process.env.PORT || 3001;
// const PORT = process.env.PORT || 8443;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
