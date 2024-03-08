const express = require("express");
const sql = require("mssql/msnodesqlv8");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const fs = require("fs").promises;
const multer = require("multer");
const path = require("path");
const nodemailer = require("nodemailer");
const { Console } = require("console");
const app = express();

const config = {
  user: "sa",
  password: "12345678",
  server: "MSI\\SQLEXPRESS",
  database: "M_Customer",
};

let pool;

async function initializePool() {
  try {
    pool = await sql.connect(config);
    console.log("Database connected successfully!");
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "poojachavan081096@gmail.com", // use your gmail here
    pass: "quks xmdh uhxe bbkz", // generate smtp password ans use here
  },
});

// Call initializePool function to set up the database connection pool
initializePool();

app.use(
  session({
    secret: "25b71c899d6fc9e2a4e19d88ad79221a43213cf550db90ee67c7dd08df8c006e",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 60000 },
  })
);

app.use(
  cors({
    origin: "http://localhost:3000",
    methods: "GET,POST,PUT", // Add PUT method to the allowed methods
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadFolder = "uploads";
    fs.mkdir(path.join(__dirname, uploadFolder), { recursive: true })
      .then(() => {
        cb(null, uploadFolder);
      })
      .catch((err) => {
        cb(err, null);
      });
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 2024 * 2024,
    fieldSize: 2024 * 2024 * 20,
  },
});

//------------------->Login Api----------------------------------------\\

app.post("/api/logincust", async (req, res) => {
  const { email, password } = req.body;

  try {
    let pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, password)
      .query(
        "SELECT * FROM Tbl_contacts WHERE Email = @email AND Password = @password"
      );

    if (result.recordset.length > 0) {
      const userData = result.recordset[0];
      console.log("User Data:", userData);

      // Store additional information in the session
      req.session.userData = {
        Cust_ID: userData.Cust_ID,
        email: userData.email,
        firstname: userData.firstname,
        lastname: userData.lastname,
        // Add more fields as needed
      };

      // Set isLoggedIn flag in session to true
      req.session.isLoggedIn = true;

      // Save the session
      req.session.save((err) => {
        if (err) {
          console.error("Error saving session:", err);
          res.status(500).json({ error: "Failed to save session" });
        } else {
          console.log("Session saved successfully");
          console.log("Session on server side:", req.session);
          console.log("Cust_ID on server side:", req.session.userData.Cust_ID);

          // Send a success response with login data
          res.json({
            success: true,
            message: "Login successful",
            Cust_ID: userData.Cust_ID,
            userEmail: userData.email,
          });
        }
      });
    } else {
      res.json({ success: false, message: "Invalid credentials" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to connect to the database" });
  }
});

app.get("/profile/:custid", async (req, res) => {
  const custid = req.params.custid;

  try {
    const result = await pool
      .request()
      .input("custid", sql.Int, custid)
      .query("SELECT * FROM Tbl_contacts WHERE Cust_ID = @custid");

    if (result.recordset.length > 0) {
      const profileData = result.recordset[0];
      res.json(profileData);
    } else {
      res.status(404).json({ error: "Profile not found" });
    }
  } catch (error) {
    console.error("Error fetching profile data:", error);
    res.status(500).json({ error: "Failed to fetch profile data" });
  }
});

app.post("/api/change-password", async (req, res) => {
  const { email, oldPassword, newPassword, repeatPassword } = req.body;

  if (!pool) {
    return res
      .status(500)
      .json({ success: false, message: "Database connection not established" });
  }

  // Validate if new password and repeat password match
  if (newPassword !== repeatPassword) {
    return res.json({
      success: false,
      message: "New password and repeat password do not match",
    });
  }

  try {
    // Check old password if provided
    const checkOldPasswordResult = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("oldPassword", sql.NVarChar, oldPassword)
      .query(
        "SELECT COUNT(*) AS count FROM Tbl_contacts WHERE Email = @email AND Password = @oldPassword"
      );

    if (checkOldPasswordResult.recordset[0].count === 0) {
      return res.json({ success: false, message: "Old password is incorrect" });
    }

    // Update password
    const updatePasswordResult = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("newPassword", sql.NVarChar, newPassword)
      .query(
        "UPDATE Tbl_contacts SET Password = @newPassword WHERE Email = @email"
      );

    if (updatePasswordResult.rowsAffected[0] > 0) {
      res.json({ success: true, message: "Password changed successfully" });
    } else {
      res.json({ success: false, message: "Password change failed" });
    }
  } catch (error) {
    console.error("Database error:", error);
    res.sendStatus(500);
  }
});

app.put("/profile/:custid", async (req, res) => {
  const vendorId = req.params.vendorId;
  const { email, phonenumber, firstname, lastname } = req.body; // Extract email, phone number, first name, and last name from request body

  try {
    // Update the specific fields in the database for the vendor
    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("phonenumber", sql.NVarChar, phonenumber)
      .input("firstname", sql.NVarChar, firstname)
      .input("lastname", sql.NVarChar, lastname)
      .input("custid", sql.Int, custid)
      .query(
        "UPDATE Tbl_contacts SET email = @email, phonenumber = @phonenumber, firstname = @firstname, lastname = @lastname WHERE Cust_ID = @custid"
      );

    if (result.rowsAffected[0] === 1) {
      res.json({ success: true, message: "Profile updated successfully" });
    } else {
      res.status(404).json({ success: false, message: "Vendor not found" });
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/getprojects/:custid", async (req, res) => {
  const { custid } = req.params;

  try {
    const result = await pool
      .request()
      .input("custid", sql.Int, custid)
      .query("SELECT * FROM Tbl_projects WHERE Cust_ID = @custid");

    if (result.recordset.length > 0) {
      res.json(result.recordset);
    } else {
      res.status(404).json({ error: "Projects not found for the customer ID" });
    }
  } catch (error) {
    console.error("Error fetching project data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/getinvoice/:custid", async (req, res) => {
  const { custid } = req.params;
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("custid", sql.Int, custid)
      .query("SELECT * FROM Tbl_Invoice WHERE Cust_ID = @custid");
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching invoice data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/getinvoicedetail/:ID", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("Id", sql.Int, req.params.ID)
      .query(
        "SELECT ShiP_To, Bill_To, InvoiceNo, Status FROM Tbl_Invoice WHERE ID = @Id"
      );

    if (result.recordset.length === 0) {
      res.status(404).json({ message: "Invoice not found" });
    } else {
      res.json(result.recordset[0]);
    }
  } catch (error) {
    console.error("Error fetching invoice data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/getcontracts/:custid", async (req, res) => {
  const { custid } = req.params;
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("custid", sql.Int, custid)
      .query("SELECT * FROM Tbl_contractsVendor WHERE Cust_ID = @custid");
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching contract data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/getcontracts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("id", sql.NVarChar(200), id)
      .query("SELECT * FROM Tbl_contractsVendor WHERE id = @id");

    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching project data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/getestimate/:custid", async (req, res) => {
  const { custid } = req.params;
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("custid", sql.Int, custid)
      .query("SELECT * FROM Tbl_Estimate  WHERE Cust_ID = @custid");
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching invoice data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/getestimatedetail/:ID", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("Id", sql.Int, req.params.ID)
      .query(
        "SELECT ShiP_To, Bill_To, EstimateNo,Status FROM Tbl_Estimate WHERE ID = @Id"
      );

    if (result.recordset.length === 0) {
      res.status(404).json({ message: "Invoice not found" });
    } else {
      res.json(result.recordset[0]);
    }
  } catch (error) {
    console.error("Error fetching invoice data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/workordertax/:WorkOrderNumber", async (req, res) => {
  try {
    const { WorkOrderNumber } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("WorkOrderNumber", sql.NVarChar, WorkOrderNumber)
      .query(
        "SELECT * FROM Tbl_WorkOrderItem WHERE WorkOrderNumber = @WorkOrderNumber"
      );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/Workfiles/:WorkOrderNumber", async (req, res) => {
  try {
    const { WorkOrderNumber } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("WorkOrderNumber", sql.NVarChar, WorkOrderNumber)
      .query(
        "SELECT * FROM Tbl_WorkOrderFile WHERE WorkOrderNumber = @WorkOrderNumber"
      );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/workorder-tenders/:custid", async (req, res) => {
  const { custid } = req.params;
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()

      .input("custid", sql.Int, custid).query(`
          SELECT * FROM Tbl_Work_Order_Calculation WHERE OrderPublish = 1 AND  Cust_ID=@custid AND Accepted = 0 AND Declined=0 AND Canceled=0
        `);

    const workorderTenders = result.recordset;
    const workorderCount = workorderTenders.length;

    res.json({ workorderTenders, workorderCount });
  } catch (error) {
    console.error("Error executing SQL query", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get(
  "/api/workorder-tenders-page/:WorkOrderNumber/:custid",
  async (req, res) => {
    try {
      const { WorkOrderNumber } = req.params;
      const { custid } = req.params;
      const pool = await sql.connect(config);
      const result = await pool
        .request()
        .input("WorkOrderNumber", sql.NVarChar, WorkOrderNumber)
        .input("custid", sql.Int, custid).query(`
          SELECT * FROM Tbl_Work_Order_Calculation WHERE Cust_ID=@custid AND WorkOrderNumber=@WorkOrderNumber
        `);

      const workorderTenders = result.recordset;
      const workorderCount = workorderTenders.length;

      res.json({ workorderTenders, workorderCount });
    } catch (error) {
      console.error("Error executing SQL query", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.get("/api/submittedqueansworkorder/:WorkOrderNumber", async (req, res) => {
  const WorkOrderNumber = req.params.WorkOrderNumber;
  console.log("Express WorkOrderNumber:", WorkOrderNumber);

  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("WorkOrderNumber", sql.NVarChar, WorkOrderNumber)
      .query(
        "SELECT * FROM Tbl_WorkOrder_QueAns WHERE WorkOrderNumber = @WorkOrderNumber"
      );

    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching tender questions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/api/workorderAccept/:WorkOrderNumber/:custid", async (req, res) => {
  const { WorkOrderNumber, custid } = req.params;
  const { TenderNumber } = req.body; // Assuming these are sent in the request body
  console.log("Request Body:", req.body); // Log the entire request body

  try {
    const result = await pool
      .request()
      .input("WorkOrderNumber", sql.VarChar, WorkOrderNumber)
      .input("custid", sql.Int, custid).query(`
          UPDATE [dbo].[Tbl_Work_Order_Calculation]
          SET Accepted = 1
          WHERE WorkOrderNumber = @WorkOrderNumber AND Cust_ID=@custid
        `);

    if (result.rowsAffected[0] === 1) {
      // Work order updated successfully, send emails
      const vendorMailOptions = {
        from: "poojachavan081096@gmail.com",
        to: "poojachavan081096@gmail.com",
        subject: "Your work order accepted",
        text: `A new form has been submitted with the following details:
          
            Work Order Number: ${WorkOrderNumber}`,
      };

      const profileResponse = await pool
        .request()
        .input("custid", sql.NVarChar, custid)
        .query("SELECT email FROM Tbl_contactsVendor WHERE Cust_ID = @custid");

      const customerEmail = profileResponse.recordset[0].email;

      const customerMailOptions = {
        from: "poojachavan081096@gmail.com",
        to: customerEmail,
        subject: "Thank you for contacting us",
        text: `Dear Customer,
            Thank you for submitting your Work order. We will get back to you as soon as possible.
           
            Work Order Number: ${WorkOrderNumber}`,
      };

      // Send emails
      await transporter.sendMail(vendorMailOptions);
      await transporter.sendMail(customerMailOptions);

      res.json({ success: true, message: "Accepted updated successfully" });
    } else {
      res.status(404).json({ success: false, message: "Work order not found" });
    }
  } catch (error) {
    console.error("Error updating Accepted column:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/acceptedworkorder/:custid", async (req, res) => {
  try {
    const { custid } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()

      .input("custid", sql.Int, custid).query(`
          SELECT *  FROM Tbl_Work_Order_Calculation
          WHERE Accepted = 1 AND Cust_ID=@custid
        `);

    const acceptedTenders = result.recordset;
    const acceptedCount = acceptedTenders.length;

    res.json({ acceptedTenders, acceptedCount });
  } catch (error) {
    console.error("Error executing SQL query", error);
    res.status(500).send("Internal Server Error");
  }
});

app.put(
  "/api/workorder-declined/:WorkOrderNumber/:custid",
  async (req, res) => {
    const { WorkOrderNumber, custid } = req.params;
    const { reason } = req.body;

    try {
      // Perform the SQL update
      const result = await pool
        .request()
        .input("custid", sql.Int, custid)
        .input("WorkOrderNumber", sql.NVarChar, WorkOrderNumber)
        .input("reason", sql.NVarChar, reason)
        .query(
          "UPDATE Tbl_Work_Order_Calculation SET Declined_Reason = @reason, Declined = 1 WHERE WorkOrderNumber = @WorkOrderNumber AND Cust_ID = @custid"
        );

      // Check if the update was successful
      if (result.rowsAffected[0] === 1) {
        // Work order updated successfully, send emails
        const vendorMailOptions = {
          from: "poojachavan081096@gmail.com",
          to: "poojachavan081096@gmail.com",
          subject: "Your work order Decline",
          text: `work order decline for workordernumber:
          
            Work Order Number: ${WorkOrderNumber}`,
        };

        const profileResponse = await pool
          .request()
          .input("custid", sql.NVarChar, custid)
          .query(
            "SELECT email FROM Tbl_contactsVendor WHERE Cust_ID = @custid"
          );

        const customerEmail = profileResponse.recordset[0].email;

        const customerMailOptions = {
          from: "poojachavan081096@gmail.com",
          to: customerEmail,
          subject: "Thank you for contacting us",
          text: `Dear Customer,
  
          We regret to inform you that after careful consideration, we are unable to proceed with the work order for the following details:
          
          Work Order Number: ${WorkOrderNumber}
      
          Please feel free to contact us for further details or to discuss alternatives.`,
        };

        // Send emails
        await transporter.sendMail(vendorMailOptions);
        await transporter.sendMail(customerMailOptions);

        // Respond to the client
        res.status(200).json({ message: "Work order rejected successfully" });
      } else {
        // Rows were not affected, meaning no update was made
        res.status(400).json({ error: "Work order update failed" });
      }
    } catch (error) {
      console.error("Error rejecting work order:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.get("/api/declinedworkorder/:custid", async (req, res) => {
  try {
    const { custid } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()

      .input("custid", sql.Int, custid).query(`
          SELECT *  FROM Tbl_Work_Order_Calculation
          WHERE Declined = 1 AND Cust_ID=@custid
        `);

    const declinedTenders = result.recordset;
    const declinedCount = declinedTenders.length;

    res.json({ declinedTenders, declinedCount });
  } catch (error) {
    console.error("Error executing SQL query", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/cancelledworkorder/:custid", async (req, res) => {
  try {
    const { custid } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()

      .input("custid", sql.Int, custid).query(`
          SELECT *  FROM Tbl_Work_Order_Calculation
          WHERE Canceled = 1 AND Cust_ID=@custid
        `);

    const cancelledTenders = result.recordset;
    const cancelledCount = cancelledTenders.length;

    res.json({ cancelledTenders, cancelledCount });
  } catch (error) {
    console.error("Error executing SQL query", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/companydetails", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query("SELECT * FROM Tbl_Company");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/saveTicket", upload.array("attachment"), async (req, res) => {
  let pool;
  try {
    const currentDate = new Date().toISOString();
    const raiseId = req.body.raiseId;
    const raiseName = req.body.raiseName;

    pool = await sql.connect(config);

    // Insert ticket data into Tbl_Support_Ticket table
    const ticketResult = await pool
      .request()
      .input("ticketNumber", sql.NVarChar, req.body.ticketNumber)
      .input("subject", sql.NVarChar, req.body.subject)
      .input("projectName", sql.NVarChar, req.body.projectName)
      .input("department", sql.NVarChar, req.body.department)
      .input("priority", sql.NVarChar, req.body.priority)
      .input("ticketBody", sql.NVarChar, req.body.ticketBody)
      .input("raiseBy", sql.NVarChar, raiseName)
      .input("raiseID", sql.Int, raiseId)
      .input("createDate", sql.DateTime, currentDate)
      .input("updateDate", sql.DateTime, currentDate)
      .input("status", sql.Bit, req.body.status)
      .input("createBy", sql.NVarChar, req.body.createBy)
      .input("lastReply", sql.NVarChar, req.body.lastReply)
      .input("lastReplyDate", sql.DateTime, req.body.lastReplyDate)
      .query(`INSERT INTO Tbl_Support_Ticket (Ticket_Number, Project_Name, Subject, Department, Priority, Raise_By, Raise_ID, Ticket_Body, CreateDate, Updatedate, Status, Createby, LastReply, LastReplydate) 
                VALUES  (@ticketNumber, @projectName, @subject, @department, @priority, @raiseBy, @raiseID, @ticketBody, @createDate, @updateDate, @status, @createBy, @lastReply, @lastReplyDate)`);

    const vendorMailOptions = {
      from: "poojachavan081096@gmail.com",
      to: "poojachavan081096@gmail.com",
      subject: "New form submitted",
      attachments: req.files
        ? req.files.map((file) => ({
            filename: file.originalname,
            path: file.path,
          }))
        : [],
      text: `A new form has been submitted with the following details:
        Ticket Number: ${req.body.ticketNumber}
          Subject: ${req.body.subject}
          Project: ${req.body.projectName}
          Department: ${req.body.department}
           Priority: ${req.body.priority}
        `,
    };

    const profileResponse = await pool
      .request()
      .input("custid", sql.NVarChar, raiseId)
      .query("SELECT email FROM Tbl_contacts WHERE Cust_ID = @custid");

    const customerEmail = profileResponse.recordset[0].email;

    const customerMailOptions = {
      from: "poojachavan081096@gmail.com",
      to: customerEmail,
      subject: "Thank you for contacting us",
      text: `Dear ${req.body.subject},
          \n\nThank you for submitting your ticket. We will get back to you as soon as possible.
          \n\nBest Regards,\nThe Support Team`,
    };

    await transporter.sendMail(vendorMailOptions);
    await transporter.sendMail(customerMailOptions);

    console.log("Emails sent successfully");
    const createDate = new Date();
    const updateDate = createDate;

    // Loop through each file and insert into Tbl_Ticket_Files
    for (const file of req.files) {
      const fileResult = await pool
        .request()
        .input("ticketNumber", sql.NVarChar, req.body.ticketNumber)
        .input("ticketID", sql.NVarChar, "placeholder_ticketID")
        .input("tickFile", sql.NVarChar, file.filename)
        .input("tickFilePath", sql.NVarChar, file.path)
        .input("extension", sql.NVarChar, file.mimetype)
        .input("raiseBy", sql.NVarChar, raiseName)
        .input("raiseID", sql.NVarChar, raiseId)
        .input("createDate", sql.DateTime, createDate)
        .input("updateDate", sql.DateTime, updateDate)
        .input("status", sql.Bit, 0)
        .input("createBy", sql.NVarChar, "placeholder_createBy")
        .input("lastReply", sql.NVarChar, "placeholder_lastReply")
        .input("lastReplyDate", sql.DateTime, null)
        .query(`INSERT INTO Tbl_Ticket_Files (Ticket_Number, Ticket_ID, Tick_File, Tick_Filepath, Extension, Raise_By, Raise_ID, CreateDate, Updatedate, Status, Createby, LastReply, LastReplydate) 
                  VALUES (@ticketNumber, @ticketID, @tickFile, @tickFilePath, @extension, @raiseBy, @raiseID, @createDate, @updateDate, @status, @createBy, @lastReply, @lastReplyDate)`);
    }

    res.status(200).json({ message: "Ticket saved successfully" });
  } catch (error) {
    console.error("Error occurred while saving ticket:", error);
    res.status(500).json({ error: "An error occurred while saving ticket" });
  }
});

app.get("/generateTicketNumber", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().execute("GenerateTicketNumber");

    const newTicketNumber = result.recordset[0].NewTicketNumber;

    res.json({ newTicketNumber });
  } catch (error) {
    console.error("Error fetching last ticket number:", error);
    res
      .status(500)
      .json({ error: "An error occurred while generating new ticket number" });
  }
});

app.post("/api/update-email", async (req, res) => {
  const { oldEmail, newEmail } = req.body;

  try {
    const pool = await sql.connect(config);

    // Check if the new email already exists
    const emailCheckResult = await pool
      .request()
      .input("newEmail", sql.NVarChar, newEmail)
      .query(
        "SELECT COUNT(*) AS count FROM Tbl_contacts WHERE Email = @newEmail"
      );

    if (emailCheckResult.recordset[0].count > 0) {
      res.json({ success: false, message: "Email already exists" });
      return;
    }

    // Update the email
    const result = await pool
      .request()
      .input("oldEmail", sql.NVarChar, oldEmail)
      .input("newEmail", sql.NVarChar, newEmail)
      .query(
        "UPDATE Tbl_contacts SET Email = @newEmail WHERE Email = @oldEmail"
      );

    if (result.rowsAffected[0] > 0) {
      res.json({ success: true, message: "Email updated successfully" });
    } else {
      res.json({ success: false, message: "Email update failed" });
    }
  } catch (error) {
    console.error("Database error:", error);
    res.sendStatus(500);
  }
});

app.post("/api/reset_password", async (req, res) => {
  const { email } = req.body;

  try {
    // Generate a random OTP (you might want to use a better method)
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Update the user's OTP in the database
    const updateOtpResult = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("otp", sql.NVarChar, otp)
      .query("UPDATE Tbl_contacts SET OTP = @otp WHERE Email = @email");

    if (updateOtpResult.rowsAffected[0] > 0) {
      // Send an email to the user with the OTP
      const mailOptions = {
        from: "your-email@gmail.com", // Replace with your email
        to: email,
        subject: "Password Reset OTP",
        text: `Your OTP for password reset is: ${otp}`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Email error:", error);
          res.json({ success: false, message: "Failed to send OTP to email" });
        } else {
          res.json({
            success: true,
            message: "OTP sent to the email for verification",
          });
        }
      });
    } else {
      res.json({ success: false, message: "Failed to update OTP" });
    }
  } catch (error) {
    console.error("Database error:", error);
    res.sendStatus(500);
  }
});

app.post("/api/reset_password_submission", async (req, res) => {
  await initializePool(); // Ensure the pool is initialized

  const { email, newPassword, confirmPassword } = req.body;
  console.log("Received data:", { email, newPassword, confirmPassword });

  if (newPassword !== confirmPassword) {
    return res.json({
      success: false,
      message: "New password and confirm password do not match",
    });
  }

  try {
    const pool = await sql.connect(config);

    // Update the user's password in the database
    const updatePasswordResult = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("newPassword", sql.NVarChar, newPassword)
      .query(
        "UPDATE Tbl_contacts SET Password = @newPassword WHERE Email = @email"
      );

    console.log("SQL Query:", updatePasswordResult);

    if (updatePasswordResult.rowsAffected[0] > 0) {
      res.json({ success: true, message: "Password reset successful" });
    } else {
      res.json({
        success: false,
        message: "Invalid email or password reset failed",
      });
    }
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/verify_otp", async (req, res) => {
  const { email, otp } = req.body;

  // Ensure email and OTP are provided
  if (!email || !otp) {
    return res.status(400).send("Email and OTP must be provided.");
  }

  try {
    // Establish database connection
    const pool = await sql.connect(config);

    // Fetch stored OTP for the provided email
    const result =
      await sql.query`SELECT otp FROM Tbl_contacts WHERE Email = ${email}`;

    if (result.recordset.length > 0) {
      const storedOtp = result.recordset[0].otp;

      // Ensure the stored OTP is a string
      const storedOtpString = String(storedOtp).trim();
      const userOtpString = otp.trim();

      if (userOtpString === storedOtpString) {
        res.sendStatus(200); // OTP verification successful
      } else {
        res.status(401).send("Invalid OTP"); // OTP mismatch
      }
    } else {
      res.status(404).send("User not found"); // Email not in database
    }
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).send("Server error during OTP verification");
  }
});

//////////////////////////////////////////////////////////////tender///////////////////////////////////////////////////////

// app.get("/api/tenders", async (req, res) => {
//   try {
//     const pool = await sql.connect(config);
//     const result = await pool.request().query("SELECT * FROM Tbl_Tender");
//     res.json(result.recordset);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.get("/api/tender_rates", async (req, res) => {
//   try {
//     const pool = await sql.connect(config);
//     const result = await pool.request().query("SELECT * FROM Tbl_TenderItem");
//     res.json(result.recordset);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.get("/api/tender_ratesedit/:TenderNo", async (req, res) => {
//   try {
//     const { TenderNo } = req.params;
//     const pool = await sql.connect(config);
//     const result = await pool
//       .request()
//       .input("TenderNo", sql.NVarChar(200), TenderNo)
//       .query(
//         "SELECT * FROM Tbl_TenderItemVendor WHERE TenderNumber = @TenderNo"
//       );

//     res.json(result.recordset);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.put("/api/update_tenders/:TenderNo", async (req, res) => {
//   try {
//     const { TenderNo } = req.params;
//     const {
//       tenders,
//       custid,
//       totalItemAmount,
//       totalTaxAmount,
//       grandTotalAmount,
//     } = req.body;
//     const pool = await sql.connect(config);
//     const transaction = await pool.transaction();

//     try {
//       await transaction.begin();

//       for (const tender of tenders) {
//         await transaction
//           .request()
//           .input("TenderNo", sql.NVarChar(200), TenderNo)
//           .input("ID", sql.Int, tender.ID)
//           .input("custid", sql.NVarChar(200), tender.custid)
//           .input("CustomerID", sql.Int, tender.CustomerID)
//           .input("ProjectID", sql.Int, tender.ProjectID)
//           .input("Item", sql.NVarChar(250), tender.Item)
//           .input("Description", sql.NVarChar(sql.MAX), tender.Description)
//           .input("Qnty", sql.Int, tender.Qnty)
//           .input("Rate", sql.Float, tender.Rate)
//           .input("Tax1Name", sql.NVarChar(230), tender.Tax1Name)
//           .input("Tax1Rate", sql.Float, tender.Tax1Rate)
//           .input("Tax2Name", sql.NVarChar(230), tender.Tax2Name)
//           .input("Tax2Rate", sql.Float, tender.Tax2Rate)
//           .input("TotalAmont", sql.Float, tender.TotalAmont).query(`
//             UPDATE Tbl_TenderItemVendor
//             SET
//               TenderNumber = @TenderNo,
//               custid = @custid,
//               CustomerID = @CustomerID,
//               ProjectID = @ProjectID,
//               Item = @Item,
//               Description = @Description,
//               Qnty = @Qnty,
//               Rate = @Rate,
//               Tax1Name = @Tax1Name,
//               Tax1Rate = @Tax1Rate,
//               Tax2Name = @Tax2Name,
//               Tax2Rate = @Tax2Rate,
//               TotalAmont = @TotalAmont
//             WHERE TenderNumber = @TenderNo AND ID = @ID
//           `);
//       }

//       // Update or insert into Tbl_Tender_Vender_Calculation
//       await transaction
//         .request()
//         .input("Cust_ID", sql.Float, custid)
//         .input("TotalItemAmount", sql.Float, totalItemAmount)
//         .input("TotalTaxAmount", sql.Float, totalTaxAmount)
//         .input("GrandTotalAmount", sql.Float, grandTotalAmount)
//         .input("TenderNo", sql.NVarChar(200), TenderNo).query(`
//         UPDATE Tbl_Tender_Vender_Calculation
//         SET
//             TotalSubTotal = @TotalItemAmount,
//             TotalTaxTotal = @TotalTaxAmount,
//             TotalAmountTender = @GrandTotalAmount
//             WHERE TenderNumber = @TenderNo AND Cust_ID = @Cust_ID
//         `);

//       await transaction.commit();

//       res.status(200).send("Tenders updated successfully");
//     } catch (error) {
//       await transaction.rollback();
//       console.error("Error updating tenders:", error);
//       res.status(500).send("Internal Server Error");
//     }
//   } catch (error) {
//     console.error("Error establishing database connection:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.post("/api/insert_tenders/:custid", async (req, res) => {
//   try {
//     const { tenders } = req.body;
//     const pool = await sql.connect(config);
//     const { custid } = req.params;
//     for (const tender of tenders) {
//       // Fetch TenderID from Tbl_Tender
//       const tenderIdResult = await pool
//         .request()
//         .input("TenderNumber", sql.NVarChar(200), tender.TenderNumber).query(`
//           SELECT ID
//           FROM Tbl_Tender
//           WHERE TenderNo = @TenderNumber;
//         `);

//       const tenderId = tenderIdResult.recordset[0].ID;

//       // Insert into Tbl_TenderItemVendor
//       await pool
//         .request()
//         .input("TenderID", sql.Int, tenderId)
//         .input("TenderNumber", sql.NVarChar(200), tender.TenderNumber)
//         .input("Cust_ID", sql.Int, custid) // Updated to Cust_ID
//         .input("CustomerID", sql.Int, tender.CustomerID)
//         .input("ProjectID", sql.Int, tender.ProjectID)
//         .input("Item", sql.NVarChar(250), tender.Item)
//         .input("Description", sql.NVarChar(sql.MAX), tender.Description)
//         .input("Qnty", sql.Int, tender.Qnty)
//         .input("Rate", sql.Float, tender.Rate)
//         .input("Tax1Name", sql.NVarChar(230), tender.Tax1Name)
//         .input("Tax1Rate", sql.Float, tender.Tax1Rate)
//         .input("Tax2Name", sql.NVarChar(230), tender.Tax2Name)
//         .input("Tax2Rate", sql.Float, tender.Tax2Rate)
//         .input("TotalAmont", sql.Float, tender.TotalAmont).query(`
//           INSERT INTO Tbl_TenderItemVendor
//           (TenderNumber, TenderID, Cust_ID, CustomerID, ProjectID, Item, Description, Qnty, Rate, Tax1Name, Tax1Rate, Tax2Name, Tax2Rate, TotalAmont)
//           VALUES
//           (@TenderNumber, @TenderID, @Cust_ID, @CustomerID, @ProjectID, @Item, @Description, @Qnty, @Rate, @Tax1Name, @Tax1Rate, @Tax2Name, @Tax2Rate, @TotalAmont)
//         `);
//     }

//     res.status(200).send("Tenders inserted successfully");
//   } catch (error) {
//     console.error("Error inserting tenders:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.get("/api/tenders", async (req, res) => {
//   try {
//     const pool = await sql.connect(config);
//     const result = await pool.request().query("SELECT * FROM Tbl_Tender");
//     res.json(result.recordset);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.get("/api/tenderdetails/:TenderNo", async (req, res) => {
//   try {
//     const { TenderNo } = req.params;
//     console.log("Requested Tender Number:", TenderNo);

//     const pool = await sql.connect(config);

//     const result = await pool
//       .request()
//       .input("tenderNo", sql.VarChar, TenderNo)
//       .query("SELECT * FROM Tbl_Tender WHERE TenderNo = @tenderNo");

//     if (result.recordset.length > 0) {
//       res.json(result.recordset[0]);
//     } else {
//       res.status(404).send("Tender not found");
//     }
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.get("/api/tenderquestions/:TenderNo", async (req, res) => {
//   const TenderNo = req.params.TenderNo;
//   console.log("Express Tender Number:", TenderNo);

//   try {
//     const pool = await sql.connect(config);
//     const result = await pool
//       .request()
//       .input("TenderNo", sql.NVarChar, TenderNo)
//       .query("SELECT * FROM Tbl_TenderQueAns WHERE TenderNumber = @TenderNo");

//     console.log("SQL Query Parameters:", TenderNo);
//     res.json(result.recordset);
//   } catch (error) {
//     console.error("Error fetching tender questions:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// app.get("/api/tenderdata/:tenderNo", async (req, res) => {
//   const TenderNo = req.params.tenderNo;
//   console.log("Express Tender Number for Data:", TenderNo);

//   try {
//     const pool = await sql.connect(config);

//     // Fetch data from Tbl_TenderQueAns
//     const questionsResult = await pool
//       .request()
//       .input("tenderNo", sql.NVarChar, TenderNo)
//       .query("SELECT * FROM Tbl_TenderQueAns WHERE TenderNumber = @tenderNo");

//     // Fetch data from Tbl_TenderItem
//     const itemsResult = await pool
//       .request()
//       .input("tenderNo", sql.NVarChar, TenderNo)
//       .query("SELECT * FROM Tbl_TenderItem WHERE TenderNumber = @tenderNo");

//     // Combine results from both tables
//     const responseData = {
//       questions: questionsResult.recordset,
//       items: itemsResult.recordset,
//     };

//     console.log("SQL Query Parameters for Data:", TenderNo);
//     res.json(responseData);
//   } catch (error) {
//     console.error("Error fetching tender data:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// app.get("/api/tenderdocuments/:tenderNo", async (req, res) => {
//   const { tenderNo } = req.params;

//   try {
//     const pool = await sql.connect(config);
//     const result = await pool
//       .request()
//       .input("tenderNo", sql.NVarChar, tenderNo)
//       .query("SELECT * FROM Tbl_TenderFile WHERE TenderNumber = @tenderNo");

//     if (result.recordset.length > 0) {
//       res.json(result.recordset);
//     } else {
//       res
//         .status(404)
//         .json({ error: "No documents found for the given tenderNo" });
//     }
//   } catch (error) {
//     console.error("Database error:", error);
//     res.sendStatus(500);
//   }
// });

// app.post("/api/store_totals/:custid", async (req, res) => {
//   try {
//     const { custid } = req.params;
//     const {
//       Tend_id,
//       Cust_ID,
//       totalItemAmount,
//       totalTaxAmount,
//       grandTotalAmount,
//       TenderNo,
//     } = req.body;
//     const pool = await sql.connect(config);

//     await pool
//       .request()

//       .input("TotalItemAmount", sql.Float, totalItemAmount)
//       .input("Cust_ID", sql.Int, custid)
//       .input("TotalTaxAmount", sql.Float, totalTaxAmount)
//       .input("GrandTotalAmount", sql.Float, grandTotalAmount)
//       .input("TenderNo", sql.NVarChar(200), TenderNo).query(`
//       INSERT INTO Tbl_Tender_Vender_Calculation
//       (TenderNumber, TotalSubTotal, TotalTaxTotal, TotalAmountTender, Cust_ID)
//       VALUES
//       (@TenderNo, @TotalItemAmount, @TotalTaxAmount, @GrandTotalAmount,@Cust_ID)
//     `);

//     res.status(200).send("Totals inserted successfully");
//   } catch (error) {
//     console.error("Error inserting totals:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.get("/api/tenderdetailsforapply/:TenderNo", async (req, res) => {
//   try {
//     const { TenderNo } = req.params;
//     console.log("Requested Tender Number:", TenderNo);

//     const pool = await sql.connect(config);

//     const result = await pool
//       .request()
//       .input("tenderNo", sql.VarChar, TenderNo)
//       .query("SELECT * FROM Tbl_Tender WHERE TenderNo = @tenderNo");

//     if (result.recordset.length > 0) {
//       res.json(result.recordset[0]);
//     } else {
//       res.status(404).send("Tender not found");
//     }
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.get("/api/tendergetret/:tenderNo", async (req, res) => {
//   const { tenderNo } = req.params;
//   try {
//     const pool = await sql.connect(config);
//     const result = await pool
//       .request()
//       .input("tenderNo", sql.NVarChar, tenderNo)
//       .query(
//         "SELECT * FROM Tbl_TenderItemVendor WHERE TenderNumber = @tenderNo"
//       );
//     res.json(result.recordset);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.get("/api/tendertotalamount/:tenderNo", async (req, res) => {
//   const { tenderNo } = req.params;
//   try {
//     const pool = await sql.connect(config);
//     const result = await pool
//       .request()
//       .input("tenderNo", sql.NVarChar, tenderNo)
//       .query(
//         "SELECT * FROM Tbl_Tender_Vender_Calculation WHERE TenderNumber = @tenderNo"
//       );
//     res.json(result.recordset);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.get("/api/allocated-tenders/:custid", async (req, res) => {
//   try {
//     const { custid } = req.params;
//     const pool = await sql.connect(config);
//     const result = await pool
//       .request()

//       .input("custid", sql.Int, custid).query(`
//         SELECT
//           Tbl_Tender.TenderNo,
//           Tbl_Tender.TenderName,
//           Tbl_Tender.TenderDate,
//           Tbl_Tender.AddCity,
//           Tbl_Tender.BidEndDate,
//           Tbl_Tender.TenderBased,
//           Tbl_Tender_Vender_Calculation.Apply,
//           Tbl_Tender_Vender_Calculation.Cust_ID
//         FROM Tbl_Tender
//         INNER JOIN Tbl_Tender_Vender_Calculation
//         ON Tbl_Tender.TenderNo = Tbl_Tender_Vender_Calculation.TenderNumber
//         WHERE Tbl_Tender_Vender_Calculation.Apply = 1 AND   Tbl_Tender_Vender_Calculation.Cust_ID=@custid
//       `);

//     const allocatedTenders = result.recordset;
//     const allocatedCount = allocatedTenders.length;

//     res.json({ allocatedTenders, allocatedCount });
//   } catch (error) {
//     console.error("Error executing SQL query", error);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.get("/api/rejected-tenders/:custid", async (req, res) => {
//   try {
//     const { custid } = req.params;
//     const pool = await sql.connect(config);
//     const result = await pool
//       .request()

//       .input("custid", sql.Int, custid).query(`
//         SELECT
//           Tbl_Tender.TenderNo,
//           Tbl_Tender.TenderName,
//           Tbl_Tender.TenderDate,
//           Tbl_Tender.AddCity,
//           Tbl_Tender.BidEndDate,
//           Tbl_Tender.TenderBased,
//           Tbl_Tender_Vender_Calculation.AllocateStatus,
//           Tbl_Tender_Vender_Calculation.Cust_ID
//         FROM Tbl_Tender
//         INNER JOIN Tbl_Tender_Vender_Calculation
//         ON Tbl_Tender.TenderNo = Tbl_Tender_Vender_Calculation.TenderNumber
//         WHERE Tbl_Tender_Vender_Calculation.AllocateStatus = 'Rejected' AND   Tbl_Tender_Vender_Calculation.Cust_ID=@custid
//       `);

//     const rejectedTenders = result.recordset;
//     const rejectedCount = rejectedTenders.length;

//     res.json({ rejectedTenders, rejectedCount });
//   } catch (error) {
//     console.error("Error executing SQL query", error);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.get("/api/published-tenderss/:custid", async (req, res) => {
//   try {
//     const pool = await sql.connect(config);
//     const { custid } = req.params;
//     const result = await pool.request().input("custid", sql.Int, custid).query(`
//       SELECT
//       Tbl_Tender.TenderNo,
//       Tbl_Tender.TenderName,
//       Tbl_Tender.AddCity,
//       Tbl_Tender.TenderDate,
//       Tbl_Tender.BidEndDate,
//       Tbl_Tender.TenderBased
//   FROM Tbl_Tender
//   LEFT JOIN Tbl_Tender_Vender_Calculation
//       ON Tbl_Tender.TenderNo = Tbl_Tender_Vender_Calculation.TenderNumber
//   WHERE Tbl_Tender.Publish = 1
//       AND Tbl_Tender.BidEndDate > GETDATE()
//       AND (Tbl_Tender_Vender_Calculation.Cust_ID IS NULL
//            OR Tbl_Tender_Vender_Calculation.Cust_ID <> @custid
//            OR Tbl_Tender_Vender_Calculation.Cust_ID IS NULL)
//       `);

//     const publishedTenders = result.recordset;

//     res.json({ publishedTenders });
//   } catch (error) {
//     console.error("Error executing SQL query", error);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.get("/api/applied-tenders/:custid", async (req, res) => {
//   try {
//     const pool = await sql.connect(config);
//     const { custid } = req.params;
//     const result = await pool.request().input("custid", sql.Int, custid).query(`
//         SELECT
//           Tbl_Tender.TenderNo,
//           Tbl_Tender.TenderName,
//           Tbl_Tender.AddCity,
//           Tbl_Tender.TenderDate,
//           Tbl_Tender.BidEndDate,
//           Tbl_Tender.TenderBased,
//           Tbl_Tender_Vender_Calculation.Apply,
//           Tbl_Tender_Vender_Calculation.AllocateStatus,
//           Tbl_Tender_Vender_Calculation.Cust_ID
//         FROM Tbl_Tender
//         INNER JOIN Tbl_Tender_Vender_Calculation
//         ON Tbl_Tender.TenderNo = Tbl_Tender_Vender_Calculation.TenderNumber
//         WHERE
//         Tbl_Tender_Vender_Calculation.Cust_ID = @custid;

//       `);

//     const appliedTenders = result.recordset;

//     res.json({ appliedTenders });
//   } catch (error) {
//     console.error("Error executing SQL query", error);
//     res.status(500).send("Internal Server Error");
//   }
// });

// app.get("/api/submittedqueans/:TenderNo", async (req, res) => {
//   const TenderNo = req.params.TenderNo;
//   console.log("Express Tender Number:", TenderNo);

//   try {
//     const pool = await sql.connect(config);
//     const result = await pool
//       .request()
//       .input("tenderNo", sql.NVarChar, TenderNo)
//       .query(
//         "SELECT * FROM Tbl_Tender_Vender_Mapping WHERE TenderNumber = @tenderNo"
//       );

//     console.log("SQL Query Parameters:", TenderNo);
//     res.json(result.recordset);
//   } catch (error) {
//     console.error("Error fetching tender questions:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

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

app.get("/api/tender_rates", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query("SELECT * FROM Tbl_TenderItem");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/tender_ratesedit/:custid/:TenderNo", async (req, res) => {
  try {
    const { TenderNo, custid } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("custid", sql.Int(200), custid)
      .input("TenderNo", sql.NVarChar(200), TenderNo)
      .query(
        "SELECT * FROM Tbl_TenderItemVendor WHERE TenderNumber = @TenderNo AND Cust_ID=@custid"
      );

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.put("/api/update_tenders/:custid/:TenderNo", async (req, res) => {
  try {
    const { TenderNo, custid } = req.params;
    const { tenders, totalItemAmount, totalTaxAmount, grandTotalAmount } =
      req.body;
    const pool = await sql.connect(config);
    const transaction = await pool.transaction();

    try {
      await transaction.begin();

      for (const tender of tenders) {
        await transaction
          .request()
          .input("TenderNo", sql.NVarChar(200), TenderNo)
          .input("ID", sql.Int, tender.ID)
          .input("custid", sql.NVarChar(200), custid)
          .input("CustomerID", sql.Int, tender.CustomerID)
          .input("ProjectID", sql.Int, tender.ProjectID)
          .input("Item", sql.NVarChar(250), tender.Item)
          .input("Description", sql.NVarChar(sql.MAX), tender.Description)
          .input("Qnty", sql.Int, tender.Qnty)
          .input("Rate", sql.Float, tender.Rate)
          .input("Tax1Name", sql.NVarChar(230), tender.Tax1Name)
          .input("Tax1Rate", sql.Float, tender.Tax1Rate)
          .input("Tax2Name", sql.NVarChar(230), tender.Tax2Name)
          .input("Tax2Rate", sql.Float, tender.Tax2Rate)
          .input("TotalAmont", sql.Float, tender.TotalAmont).query(`
            UPDATE Tbl_TenderItemVendor 
            SET 
              TenderNumber = @TenderNo,
              Cust_ID = @custid,
              CustomerID = @CustomerID,
              ProjectID = @ProjectID,
              Item = @Item,
              Description = @Description,
              Qnty = @Qnty,
              Rate = @Rate,
              Tax1Name = @Tax1Name,
              Tax1Rate = @Tax1Rate,
              Tax2Name = @Tax2Name,
              Tax2Rate = @Tax2Rate,
              TotalAmont = @TotalAmont
            WHERE TenderNumber = @TenderNo AND ID = @ID
          `);
      }

      await transaction
        .request()
        .input("Cust_ID", sql.Float, custid)
        .input("TotalItemAmount", sql.Float, totalItemAmount)
        .input("TotalTaxAmount", sql.Float, totalTaxAmount)
        .input("GrandTotalAmount", sql.Float, grandTotalAmount)
        .input("TenderNo", sql.NVarChar(200), TenderNo).query(`
        UPDATE Tbl_Tender_Vender_Calculation 
        SET 
            TotalSubTotal = @TotalItemAmount,
            TotalTaxTotal = @TotalTaxAmount,
            TotalAmountTender = @GrandTotalAmount
            WHERE TenderNumber = @TenderNo AND Cust_ID = @Cust_ID
        `);

      await transaction.commit();

      res.status(200).send("Tenders updated successfully");
    } catch (error) {
      await transaction.rollback();
      console.error("Error updating tenders:", error);
      res.status(500).send("Internal Server Error");
    }
  } catch (error) {
    console.error("Error establishing database connection:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/insert_tenders/:custid", async (req, res) => {
  try {
    const { tenders } = req.body;
    const pool = await sql.connect(config);
    const { custid } = req.params;
    for (const tender of tenders) {
      // Fetch TenderID from Tbl_Tender
      const tenderIdResult = await pool
        .request()
        .input("TenderNumber", sql.NVarChar(200), tender.TenderNumber).query(`
          SELECT ID
          FROM Tbl_Tender
          WHERE TenderNo = @TenderNumber;
        `);

      const tenderId = tenderIdResult.recordset[0].ID;

      // Insert into Tbl_TenderItemVendor
      await pool
        .request()
        .input("TenderID", sql.Int, tenderId)
        .input("TenderNumber", sql.NVarChar(200), tender.TenderNumber)
        .input("Cust_ID", sql.Int, custid) // Updated to Cust_ID
        .input("CustomerID", sql.Int, tender.CustomerID)
        .input("ProjectID", sql.Int, tender.ProjectID)
        .input("Item", sql.NVarChar(250), tender.Item)
        .input("Description", sql.NVarChar(sql.MAX), tender.Description)
        .input("Qnty", sql.Int, tender.Qnty)
        .input("Rate", sql.Float, tender.Rate)
        .input("Tax1Name", sql.NVarChar(230), tender.Tax1Name)
        .input("Tax1Rate", sql.Float, tender.Tax1Rate)
        .input("Tax2Name", sql.NVarChar(230), tender.Tax2Name)
        .input("Tax2Rate", sql.Float, tender.Tax2Rate)
        .input("TotalAmont", sql.Float, tender.TotalAmont).query(`
          INSERT INTO Tbl_TenderItemVendor 
          (TenderNumber, TenderID, Cust_ID, CustomerID, ProjectID, Item, Description, Qnty, Rate, Tax1Name, Tax1Rate, Tax2Name, Tax2Rate, TotalAmont) 
          VALUES 
          (@TenderNumber, @TenderID, @Cust_ID, @CustomerID, @ProjectID, @Item, @Description, @Qnty, @Rate, @Tax1Name, @Tax1Rate, @Tax2Name, @Tax2Rate, @TotalAmont)
        `);
    }

    res.status(200).send("Tenders inserted successfully");
  } catch (error) {
    console.error("Error inserting tenders:", error);
    res.status(500).send("Internal Server Error");
  }
});

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

app.get("/api/tenderdetails/:TenderNo", async (req, res) => {
  try {
    const { TenderNo } = req.params;
    console.log("Requested Tender Number:", TenderNo);

    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("tenderNo", sql.VarChar, TenderNo)
      .query("SELECT * FROM Tbl_Tender WHERE TenderNo = @tenderNo");

    if (result.recordset.length > 0) {
      res.json(result.recordset[0]);
    } else {
      res.status(404).send("Tender not found");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/tenderquestions/:TenderNo", async (req, res) => {
  const TenderNo = req.params.TenderNo;
  console.log("Express Tender Number:", TenderNo);

  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("TenderNo", sql.NVarChar, TenderNo)
      .query("SELECT * FROM Tbl_TenderQueAns WHERE TenderNumber = @TenderNo");

    console.log("SQL Query Parameters:", TenderNo);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching tender questions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/tenderdata/:tenderNo", async (req, res) => {
  const TenderNo = req.params.tenderNo;
  console.log("Express Tender Number for Data:", TenderNo);

  try {
    const pool = await sql.connect(config);

    // Fetch data from Tbl_TenderQueAns
    const questionsResult = await pool
      .request()
      .input("tenderNo", sql.NVarChar, TenderNo)
      .query("SELECT * FROM Tbl_TenderQueAns WHERE TenderNumber = @tenderNo");

    // Fetch data from Tbl_TenderItem
    const itemsResult = await pool
      .request()
      .input("tenderNo", sql.NVarChar, TenderNo)
      .query("SELECT * FROM Tbl_TenderItem WHERE TenderNumber = @tenderNo");

    // Combine results from both tables
    const responseData = {
      questions: questionsResult.recordset,
      items: itemsResult.recordset,
    };

    console.log("SQL Query Parameters for Data:", TenderNo);
    res.json(responseData);
  } catch (error) {
    console.error("Error fetching tender data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/tenderdocuments/:tenderNo", async (req, res) => {
  const { tenderNo } = req.params;

  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("tenderNo", sql.NVarChar, tenderNo)
      .query("SELECT * FROM Tbl_TenderFile WHERE TenderNumber = @tenderNo");

    if (result.recordset.length > 0) {
      res.json(result.recordset);
    } else {
      res
        .status(404)
        .json({ error: "No documents found for the given tenderNo" });
    }
  } catch (error) {
    console.error("Database error:", error);
    res.sendStatus(500);
  }
});

app.post("/api/store_totals/:custid", async (req, res) => {
  try {
    const { custid } = req.params;
    const {
      Tend_id,
      Cust_ID,
      totalItemAmount,
      totalTaxAmount,
      grandTotalAmount,
      TenderNo,
    } = req.body;
    const pool = await sql.connect(config);

    await pool
      .request()

      .input("TotalItemAmount", sql.Float, totalItemAmount)
      .input("Cust_ID", sql.Int, custid)
      .input("TotalTaxAmount", sql.Float, totalTaxAmount)
      .input("GrandTotalAmount", sql.Float, grandTotalAmount)
      .input("TenderNo", sql.NVarChar(200), TenderNo).query(`
      INSERT INTO Tbl_Tender_Vender_Calculation 
      (TenderNumber, TotalSubTotal, TotalTaxTotal, TotalAmountTender, Cust_ID) 
      VALUES 
      (@TenderNo, @TotalItemAmount, @TotalTaxAmount, @GrandTotalAmount,@Cust_ID)
    `);

    res.status(200).send("Totals inserted successfully");
  } catch (error) {
    console.error("Error inserting totals:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/tenderdetailsforapply/:TenderNo", async (req, res) => {
  try {
    const { TenderNo } = req.params;
    console.log("Requested Tender Number:", TenderNo);

    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("tenderNo", sql.VarChar, TenderNo)
      .query("SELECT * FROM Tbl_Tender WHERE TenderNo = @tenderNo");

    if (result.recordset.length > 0) {
      res.json(result.recordset[0]);
    } else {
      res.status(404).send("Tender not found");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/tendergetret/:custid/:tenderNo", async (req, res) => {
  const { tenderNo, custid } = req.params;
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("custid", sql.Int, custid)
      .input("tenderNo", sql.NVarChar, tenderNo)
      .query(
        "SELECT * FROM Tbl_TenderItemVendor WHERE TenderNumber = @tenderNo AND Cust_ID=@custid"
      );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/tendertotalamount/:custid/:tenderNo", async (req, res) => {
  const { tenderNo, custid } = req.params;
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("custid", sql.Int, custid)
      .input("tenderNo", sql.NVarChar, tenderNo)
      .query(
        "SELECT * FROM Tbl_Tender_Vender_Calculation WHERE TenderNumber = @tenderNo AND Cust_ID=@custid"
      );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/allocated-tenders/:custid", async (req, res) => {
  try {
    const { custid } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()

      .input("custid", sql.Int, custid).query(`
        SELECT 
          Tbl_Tender.TenderNo,
          Tbl_Tender.TenderName,
          Tbl_Tender.TenderDate,
          Tbl_Tender.AddCity,
          Tbl_Tender.BidEndDate,
          Tbl_Tender.TenderBased,
          Tbl_Tender_Vender_Calculation.Apply,
          Tbl_Tender_Vender_Calculation.Cust_ID
        FROM Tbl_Tender
        INNER JOIN Tbl_Tender_Vender_Calculation
        ON Tbl_Tender.TenderNo = Tbl_Tender_Vender_Calculation.TenderNumber
        WHERE Tbl_Tender_Vender_Calculation.Apply = 1 AND   Tbl_Tender_Vender_Calculation.Cust_ID=@custid
      `);

    const allocatedTenders = result.recordset;
    const allocatedCount = allocatedTenders.length;

    res.json({ allocatedTenders, allocatedCount });
  } catch (error) {
    console.error("Error executing SQL query", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/rejected-tenders/:custid", async (req, res) => {
  try {
    const { custid } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()

      .input("custid", sql.Int, custid).query(`
        SELECT 
          Tbl_Tender.TenderNo,
          Tbl_Tender.TenderName,
          Tbl_Tender.TenderDate,
          Tbl_Tender.AddCity,
          Tbl_Tender.BidEndDate,
          Tbl_Tender.TenderBased,
          Tbl_Tender_Vender_Calculation.AllocateStatus,
          Tbl_Tender_Vender_Calculation.Cust_ID
        FROM Tbl_Tender
        INNER JOIN Tbl_Tender_Vender_Calculation
        ON Tbl_Tender.TenderNo = Tbl_Tender_Vender_Calculation.TenderNumber
        WHERE Tbl_Tender_Vender_Calculation.AllocateStatus = 'Rejected' AND   Tbl_Tender_Vender_Calculation.Cust_ID=@custid
      `);

    const rejectedTenders = result.recordset;
    const rejectedCount = rejectedTenders.length;

    res.json({ rejectedTenders, rejectedCount });
  } catch (error) {
    console.error("Error executing SQL query", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/published-tenderss/:custid", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const { custid } = req.params;
    const result = await pool.request().input("custid", sql.Int, custid).query(`
      SELECT 
      Tbl_Tender.TenderNo,
      Tbl_Tender.TenderName,
      Tbl_Tender.AddCity,
      Tbl_Tender.TenderDate,
      Tbl_Tender.BidEndDate,
      Tbl_Tender.TenderBased
  FROM Tbl_Tender
  LEFT JOIN Tbl_Tender_Vender_Calculation
      ON Tbl_Tender.TenderNo = Tbl_Tender_Vender_Calculation.TenderNumber
  WHERE Tbl_Tender.Publish = 1
      AND Tbl_Tender.BidEndDate > GETDATE()
      AND (Tbl_Tender_Vender_Calculation.Cust_ID IS NULL
           OR Tbl_Tender_Vender_Calculation.Cust_ID <> @custid
           OR Tbl_Tender_Vender_Calculation.Cust_ID IS NULL)         
      `);

    const publishedTenders = result.recordset;

    res.json({ publishedTenders });
  } catch (error) {
    console.error("Error executing SQL query", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/applied-tenders/:custid", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const { custid } = req.params;
    const result = await pool.request().input("custid", sql.Int, custid).query(`
        SELECT 
          Tbl_Tender.TenderNo,
          Tbl_Tender.TenderName,
          Tbl_Tender.AddCity,
          Tbl_Tender.TenderDate,
          Tbl_Tender.BidEndDate,
          Tbl_Tender.TenderBased,
          Tbl_Tender_Vender_Calculation.Apply,
          Tbl_Tender_Vender_Calculation.AllocateStatus,
          Tbl_Tender_Vender_Calculation.Cust_ID
        FROM Tbl_Tender
        INNER JOIN Tbl_Tender_Vender_Calculation
        ON Tbl_Tender.TenderNo = Tbl_Tender_Vender_Calculation.TenderNumber
        WHERE
        Tbl_Tender_Vender_Calculation.Cust_ID = @custid;
       
      `);

    const appliedTenders = result.recordset;

    res.json({ appliedTenders });
  } catch (error) {
    console.error("Error executing SQL query", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/submittedqueans/:custid/:TenderNo", async (req, res) => {
  const TenderNo = req.params.TenderNo;
  const custid = req.params.custid;
  console.log("Express Tender Number:", TenderNo);

  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("custid", sql.Int, custid)
      .input("tenderNo", sql.NVarChar, TenderNo)
      .query(
        "SELECT * FROM Tbl_Tender_Vender_Mapping WHERE TenderNumber = @tenderNo AND Cust_ID=@custid"
      );

    console.log("SQL Query Parameters:", TenderNo);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching tender questions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/tenderquestions/:TenderNumber", async (req, res) => {
  try {
    const { TenderNumber } = req.params;
    console.log("Requested Tender Number:", TenderNumber);

    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("tenderNo", sql.VarChar, TenderNumber)
      .query("SELECT * FROM Tbl_TenderQueAns WHERE TenderNumber = @tenderNo");

    if (result.recordset.length > 0) {
      res.json(result.recordset[0]);
    } else {
      res.status(404).send("Tender not found");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.post(
  "/api/submitanswers/:tenderNumber/:custid",
  upload.array("file", 10),
  async (req, res) => {
    try {
      const { tenderNumber, custid } = req.params;
      const files = req.files;
      const pool = await sql.connect(config);

      // Fetch questions from Tbl_TenderQueAns
      const questionsResult = await pool
        .request()
        .input("tenderNumber", sql.NVarChar(200), tenderNumber)
        .query(
          "SELECT ID, Question FROM Tbl_TenderQueAns WHERE TenderNumber = @tenderNumber"
        );

      const questions = questionsResult.recordset;

      const query = `
      INSERT INTO Tbl_Tender_Vender_Mapping ( Cust_ID, TenderNumber, Tend_Que, Tend_Ans, Doc_File, Doc_Filepath, Status, CreateDate, UpdateDate, LogInType)
      VALUES ( @custid, @TenderNumber, @Tend_Que, @Tend_Ans, @Doc_File, @Doc_Filepath, @Status, @CreateDate, @UpdateDate, @LogInType);
      SELECT SCOPE_IDENTITY() AS InsertedId;
    `;

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        let fileIndex = 0; // Track the index for file-related answers

        for (let i = 0; i < questions.length; i++) {
          const question = questions[i];
          const Tend_Ans = req.body.answers[i];
          const isFileQuestion =
            question.Question.includes("Upload") ||
            question.Question.includes("Attach");
          const file = isFileQuestion ? files[fileIndex++] : null;
          const result = await transaction
            .request()
            .input("custid", sql.Int, custid)
            .input("TenderNumber", sql.NVarChar(200), tenderNumber)
            .input("Tend_Que", sql.NVarChar, question.Question)
            .input("Tend_Ans", sql.NVarChar, isFileQuestion ? null : Tend_Ans)
            .input("Doc_File", sql.NVarChar, file ? file.filename : null)
            .input("Doc_Filepath", sql.NVarChar, file ? file.path : null)
            .input("Status", sql.Bit, 1)
            .input("CreateDate", sql.DateTime, new Date())
            .input("UpdateDate", sql.DateTime, new Date())
            .input("LogInType", sql.NVarChar, "Web")
            .query(query);
          const insertedId = result.recordset[0].InsertedId;

          // Fetch the Tend_id from Tbl_Tender
          const tendIdResult = await pool
            .request()
            .input("TenderNo", sql.NVarChar(200), tenderNumber).query(`
                SELECT ID
                FROM Tbl_Tender
                WHERE TenderNo = @TenderNo;
              `);
          const tendId = tendIdResult.recordset[0].ID;
          // Update the Tend_id column in Tbl_Tender_Vender_Mapping
          await transaction
            .request()
            .input("InsertedId", sql.Int, insertedId)
            .input("TendId", sql.Int, tendId).query(`
                UPDATE Tbl_Tender_Vender_Mapping
                SET Tend_id = @TendId
                WHERE ID = @InsertedId;
              `);
        }

        await transaction.commit();
        res.json({
          message:
            "Answers submitted successfully to Tbl_Tender_Vender_Mapping",
        });
      } catch (error) {
        await transaction.rollback();
        console.error("Error during transaction:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.get("/api/companydetails", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query("SELECT * FROM Tbl_Company");
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/tenderquestions/:TenderNumber", async (req, res) => {
  try {
    const { TenderNumber } = req.params;
    console.log("Requested Tender Number:", TenderNumber);

    const pool = await sql.connect(config);

    const result = await pool
      .request()
      .input("tenderNo", sql.VarChar, TenderNumber)
      .query("SELECT * FROM Tbl_TenderQueAns WHERE TenderNumber = @tenderNo");

    if (result.recordset.length > 0) {
      res.json(result.recordset[0]);
    } else {
      res.status(404).send("Tender not found");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.post(
  "/api/submitanswers/:tenderNumber/:custid",
  upload.array("file", 10),
  async (req, res) => {
    try {
      const { tenderNumber, custid } = req.params;
      const files = req.files;
      const pool = await sql.connect(config);

      // Fetch questions from Tbl_TenderQueAns
      const questionsResult = await pool
        .request()
        .input("tenderNumber", sql.NVarChar(200), tenderNumber)
        .query(
          "SELECT ID, Question FROM Tbl_TenderQueAns WHERE TenderNumber = @tenderNumber"
        );

      const questions = questionsResult.recordset;

      const query = `
      INSERT INTO Tbl_Tender_Vender_Mapping ( Cust_ID, TenderNumber, Tend_Que, Tend_Ans, Doc_File, Doc_Filepath, Status, CreateDate, UpdateDate, LogInType)
      VALUES ( @custid, @TenderNumber, @Tend_Que, @Tend_Ans, @Doc_File, @Doc_Filepath, @Status, @CreateDate, @UpdateDate, @LogInType);
      SELECT SCOPE_IDENTITY() AS InsertedId;
    `;

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        let fileIndex = 0; // Track the index for file-related answers

        for (let i = 0; i < questions.length; i++) {
          const question = questions[i];
          const Tend_Ans = req.body.answers[i];
          const isFileQuestion =
            question.Question.includes("Upload") ||
            question.Question.includes("Attach");
          const file = isFileQuestion ? files[fileIndex++] : null;
          const result = await transaction
            .request()
            .input("custid", sql.Int, custid)
            .input("TenderNumber", sql.NVarChar(200), tenderNumber)
            .input("Tend_Que", sql.NVarChar, question.Question)
            .input("Tend_Ans", sql.NVarChar, isFileQuestion ? null : Tend_Ans)
            .input("Doc_File", sql.NVarChar, file ? file.filename : null)
            .input("Doc_Filepath", sql.NVarChar, file ? file.path : null)
            .input("Status", sql.Bit, 1)
            .input("CreateDate", sql.DateTime, new Date())
            .input("UpdateDate", sql.DateTime, new Date())
            .input("LogInType", sql.NVarChar, "Web")
            .query(query);
          const insertedId = result.recordset[0].InsertedId;

          // Fetch the Tend_id from Tbl_Tender
          const tendIdResult = await pool
            .request()
            .input("TenderNo", sql.NVarChar(200), tenderNumber).query(`
                SELECT ID
                FROM Tbl_Tender
                WHERE TenderNo = @TenderNo;
              `);
          const tendId = tendIdResult.recordset[0].ID;
          // Update the Tend_id column in Tbl_Tender_Vender_Mapping
          await transaction
            .request()
            .input("InsertedId", sql.Int, insertedId)
            .input("TendId", sql.Int, tendId).query(`
                UPDATE Tbl_Tender_Vender_Mapping
                SET Tend_id = @TendId
                WHERE ID = @InsertedId;
              `);
        }

        await transaction.commit();
        res.json({
          message:
            "Answers submitted successfully to Tbl_Tender_Vender_Mapping",
        });
      } catch (error) {
        await transaction.rollback();
        console.error("Error during transaction:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.get("/api/company-details/:custId", async (req, res) => {
  const { custId } = req.params;
  try {
    const pool = await sql.connect(config);
    // Assuming you have a way to link customers to vendors, adjust the query below
    const result = await pool.request().input("custId", sql.Int, custId)
      .query`SELECT * FROM Tbl_Vendor WHERE Cust_ID = @custId`; // Adjust your SQL query based on your database schema
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching company details by customer ID:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/announsment", async (req, res) => {
  try {
    await sql.connect(config);

    const result = await sql.query("SELECT * FROM Tbl_announcements");

    res.json(result.recordset);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  } finally {
    sql.close();
  }
});

app.get("/api/supportitem/:custid", async (req, res) => {
  const { custid } = req.params;

  try {
    const result = await pool
      .request()
      .input("Cust_ID", sql.Int, custid)

      .query("SELECT * FROM Tbl_Support_Ticket WHERE Raise_ID = @Cust_ID");

    if (result.recordset.length > 0) {
      res.json(result.recordset);
    } else {
      res.status(404).json({ error: "Projects not found for the vendor ID" });
    }
  } catch (error) {
    console.error("Error fetching project data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
