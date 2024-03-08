
const express = require("express");
const sql = require("mssql/msnodesqlv8");
const cors = require("cors");
const multer = require("multer");
const app = express();
const bodyParser = require("body-parser");
// const fs = require("fs");
const fs = require("fs").promises;
const path = require("path");
// app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const session = require("express-session");
const cookieParser = require("cookie-parser");

app.use(
  session({
    secret: "25b71c899d6fc9e2a4e19d88ad79221a43213cf550db90ee67c7dd08df8c006e",
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      maxAge: 60000, // 1 minute
    },
  })
);

app.use(
  cors({
    origin: "http://localhost:3002",
    methods: "GET,POST,PUT", // Add PUT method to the allowed methods
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "poojachavan081096@gmail.com", // use your gmail here
    pass: "quks xmdh uhxe bbkz", // generate smtp password ans use here
  },
});

const config = {
  user: "sa",
  password: "12345678",
  server: "MSI\\SQLEXPRESS",
  database: "MatoshreePortal",
};

const storages = multer.memoryStorage();

const uploads = multer({ storage: storages });



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
    fileSize: 10 * 1024 * 1024,
    fieldSize: 1024 * 1024 * 10,
  },
});

let pool;

async function initializePool() {
  try {
    pool = await sql.connect(config);
    console.log("Database connected successfully!");
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
}

initializePool();

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

app.get("/api/getprojects/:vendorId", async (req, res) => {
  const { vendorId } = req.params;

  try {
    const result = await pool
      .request()
      .input("vendorId", sql.Int, vendorId)
      .query("SELECT * FROM Tbl_projects WHERE vender_id = @vendorId");

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



app.get("/api/getcontracts/:vendorID", async (req, res) => {
  try {
    const { vendorID } = req.params;
    // Fetch contracts only for the specified VendorID
    const result = await pool
      .request()
      .input("vendorID", sql.Int, vendorID)
      .query("SELECT * FROM Tbl_contractsVendor WHERE VendorID = @vendorID");
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching contracts data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/getcontractsdetail/:id", async (req, res) => {
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


app.get("/api/tender_ratesedit/:vendorID/:TenderNo", async (req, res) => {
  try {
    const { TenderNo, vendorID } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("vendorID", sql.Int, vendorID)
      .input("TenderNo", sql.NVarChar(200), TenderNo)
      .query(
        "SELECT * FROM Tbl_TenderItemVendor WHERE TenderNumber = @TenderNo AND vendorID=@vendorID"
      );

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.put("/api/update_tenders/:TenderNo", async (req, res) => {
  try {
    const { TenderNo } = req.params;
    const {
      tenders,
      vendorID,
      totalItemAmount,
      totalTaxAmount,
      grandTotalAmount,
    } = req.body;
    const pool = await sql.connect(config);
    const transaction = await pool.transaction();

    try {
      await transaction.begin();

      for (const tender of tenders) {
        await transaction
          .request()
          .input("TenderNo", sql.NVarChar(200), TenderNo)
          .input("ID", sql.Int, tender.ID)
          .input("VendorID", sql.NVarChar(200), tender.VendorID)
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
              VendorID = @VendorID,
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

      // Update or insert into Tbl_Tender_Vender_Calculation
      await transaction
        .request()
        .input("Vend_id", sql.Float, vendorID)
        .input("TotalItemAmount", sql.Float, totalItemAmount)
        .input("TotalTaxAmount", sql.Float, totalTaxAmount)
        .input("GrandTotalAmount", sql.Float, grandTotalAmount)
        .input("TenderNo", sql.NVarChar(200), TenderNo).query(`
        UPDATE Tbl_Tender_Vender_Calculation 
        SET 
            TotalSubTotal = @TotalItemAmount,
            TotalTaxTotal = @TotalTaxAmount,
            TotalAmountTender = @GrandTotalAmount
            WHERE TenderNumber = @TenderNo AND Vend_id = @Vend_id
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

app.post("/api/insert_tenders/:vendorID", async (req, res) => {
  try {
    const { tenders } = req.body;
    const pool = await sql.connect(config);
    const { vendorID } = req.params;
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
        .input("vendorID", sql.Int, vendorID)
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
      (TenderNumber, TenderID,vendorID,CustomerID, ProjectID, Item, Description, Qnty, Rate, Tax1Name, Tax1Rate, Tax2Name, Tax2Rate, TotalAmont) 
      VALUES 
      (@TenderNumber,@TenderID,@vendorID, @CustomerID, @ProjectID, @Item, @Description, @Qnty, @Rate, @Tax1Name, @Tax1Rate, @Tax2Name, @Tax2Rate, @TotalAmont)
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

app.post("/api/store_totals/:vendorID", async (req, res) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Credentials", "true");

  try {
    const { totalItemAmount, totalTaxAmount, grandTotalAmount, TenderNo } =
      req.body;
    const pool = await sql.connect(config);
    const { vendorID } = req.params;
    const result = await pool
      .request()
      .input("Vend_id", sql.Float, vendorID)
      .input("TotalItemAmount", sql.Float, totalItemAmount)
      .input("TotalTaxAmount", sql.Float, totalTaxAmount)
      .input("GrandTotalAmount", sql.Float, grandTotalAmount)
      .input("TenderNo", sql.NVarChar(200), TenderNo).query(`
      INSERT INTO Tbl_Tender_Vender_Calculation 
      (TenderNumber,Vend_id,TotalSubTotal, TotalTaxTotal, TotalAmountTender) 
      VALUES 
      (@TenderNo,@Vend_id,@TotalItemAmount, @TotalTaxAmount, @GrandTotalAmount)
      SELECT SCOPE_IDENTITY() AS InsertedId;  -- Fetch the inserted ID
    `);
    const insertedId = result.recordset[0].InsertedId;
    const tendIdResult = await pool
      .request()
      .input("TenderNo", sql.NVarChar(200), TenderNo).query(`
        SELECT ID
        FROM Tbl_Tender
        WHERE TenderNo = @TenderNo;
      `);
    const tendId = tendIdResult.recordset[0].ID;
    await pool
      .request()
      .input("InsertedId", sql.Int, insertedId)
      .input("TendId", sql.Int, tendId).query(`
        UPDATE Tbl_Tender_Vender_Calculation
        SET Tend_id = @TendId
        WHERE ID = @InsertedId;
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

app.get("/api/tendergetret/:vendorID/:tenderNo", async (req, res) => {
  const { tenderNo, vendorID } = req.params;
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("vendorID", sql.Int, vendorID)
      .input("tenderNo", sql.NVarChar, tenderNo)
      .query(
        "SELECT * FROM Tbl_TenderItemVendor WHERE TenderNumber = @tenderNo AND vendorID=@vendorID"
      );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/tendertotalamount/:vendorID/:tenderNo", async (req, res) => {
  const { tenderNo, vendorID } = req.params;
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("vendorID", sql.Int, vendorID)
      .input("tenderNo", sql.NVarChar, tenderNo)
      .query(
        "SELECT * FROM Tbl_Tender_Vender_Calculation WHERE TenderNumber = @tenderNo  AND Vend_id=@vendorID"
      );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});


app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("password", sql.NVarChar, password)
      .query(
        "SELECT * FROM Tbl_contactsVendor WHERE email = @email AND password = @password"
      );

    if (result.recordset.length > 0) {
      const userData = result.recordset[0];
      console.log("User Data:", userData);

      // Store additional information in the session
      req.session.userData = {
        Vender_id: userData.Vender_id,
        email: userData.email,
        firstname: userData.firstname,
        lastname: userData.lastname,
        // Add more fields as needed
      };

      // Set Vender_id in session
      req.session.save((err) => {
        if (err) {
          console.error("Error saving session:", err);
          res.status(500).json({ error: "Failed to save session" });
        } else {
          console.log("Session saved successfully");
          console.log("Session on server side:", req.session);
          console.log("Vender_id on server side:", req.session.Vender_id);
          res.json({
            success: true,
            message: "Login successful",
            venderId: userData.Vender_id,
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
;

app.get("/profile/:venderId", async (req, res) => {
  const venderId = req.params.venderId;

  try {
    const result = await pool
      .request()
      .input("venderId", sql.Int, venderId)
      .query("SELECT * FROM Tbl_contactsVendor WHERE Vender_id = @venderId");

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
        "SELECT COUNT(*) AS count FROM Tbl_contactsVendor WHERE Email = @email AND Password = @oldPassword"
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
        "UPDATE Tbl_contactsVendor SET Password = @newPassword WHERE Email = @email"
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

app.put("/profile/:vendorId", async (req, res) => {
  const vendorId = req.params.vendorId;
  const { email, phonenumber, firstname, lastname } = req.body;

  try {
    const result = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .input("phonenumber", sql.NVarChar, phonenumber)
      .input("firstname", sql.NVarChar, firstname)
      .input("lastname", sql.NVarChar, lastname)
      .input("vendorId", sql.Int, vendorId)
      .query(
        "UPDATE Tbl_contactsVendor SET email = @email, phonenumber = @phonenumber, firstname = @firstname, lastname = @lastname WHERE Vender_id = @vendorId"
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
      .query("UPDATE Tbl_contactsVendor SET OTP = @otp WHERE Email = @email");

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
        "UPDATE Tbl_contactsVendor SET Password = @newPassword WHERE Email = @email"
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

  try {
    // Check if the email exists in the database
    const userResult = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT OTP FROM Tbl_contactsVendor WHERE Email = @email");

    if (userResult.recordset.length > 0) {
      const storedOTP = userResult.recordset[0].OTP;

      if (otp === storedOTP) {
        res.sendStatus(200); // Successful OTP verification
      } else {
        res.sendStatus(401); // Invalid OTP
      }
    } else {
      res.sendStatus(404); // User not found
    }
  } catch (error) {
    console.error("Database error:", error);
    res.sendStatus(500);
  }
});


app.get("/api/allocated-tenders/:vendorID", async (req, res) => {
  try {
    const { vendorID } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()

      .input("vendorID", sql.Int, vendorID).query(`
        SELECT 
          Tbl_Tender.TenderNo,
          Tbl_Tender.TenderName,
          Tbl_Tender.TenderDate,
          Tbl_Tender.AddCity,
          Tbl_Tender.BidEndDate,
          Tbl_Tender.TenderBased,
          Tbl_Tender_Vender_Calculation.Apply,
          Tbl_Tender_Vender_Calculation.Vend_id
        FROM Tbl_Tender
        INNER JOIN Tbl_Tender_Vender_Calculation
        ON Tbl_Tender.TenderNo = Tbl_Tender_Vender_Calculation.TenderNumber
        WHERE Tbl_Tender_Vender_Calculation.Apply = 1 AND   Tbl_Tender_Vender_Calculation.Vend_id=@vendorID
      `);

    const allocatedTenders = result.recordset;
    const allocatedCount = allocatedTenders.length;

    res.json({ allocatedTenders, allocatedCount });
  } catch (error) {
    console.error("Error executing SQL query", error);
    res.status(500).send("Internal Server Error");
  }
});


app.get("/api/published-tenders/:vendorID", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const { vendorID } = req.params;
    const result = await pool.request().input("vendorID", sql.Int, vendorID)
      .query(`
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
    AND (Tbl_Tender_Vender_Calculation.TenderNumber IS NULL
         OR (Tbl_Tender_Vender_Calculation.TenderNumber IS NOT NULL
             AND Tbl_Tender_Vender_Calculation.Vend_id <> @vendorID))

      `);

    const publishedTenders = result.recordset;

    res.json({ publishedTenders });
  } catch (error) {
    console.error("Error executing SQL query", error);
    res.status(500).send("Internal Server Error");
  }
});


app.get("/api/applied-tenders/:vendorID", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const { vendorID } = req.params;
    const result = await pool.request().input("vendorID", sql.Int, vendorID)
      .query(`
        SELECT 
          Tbl_Tender.TenderNo,
          Tbl_Tender.TenderName,
          Tbl_Tender.AddCity,
          Tbl_Tender.TenderDate,
          Tbl_Tender.BidEndDate,
          Tbl_Tender.TenderBased,
          Tbl_Tender_Vender_Calculation.Apply,
          Tbl_Tender_Vender_Calculation.AllocateStatus,
          Tbl_Tender_Vender_Calculation.Vend_id
        FROM Tbl_Tender
        INNER JOIN Tbl_Tender_Vender_Calculation
        ON Tbl_Tender.TenderNo = Tbl_Tender_Vender_Calculation.TenderNumber
        WHERE
        Tbl_Tender_Vender_Calculation.Vend_id = @vendorID;
       
      `);

    const appliedTenders = result.recordset;

    res.json({ appliedTenders });
  } catch (error) {
    console.error("Error executing SQL query", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/rejected-tenders/:vendorID", async (req, res) => {
  try {
    const { vendorID } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()

      .input("vendorID", sql.Int, vendorID).query(`
        SELECT 
          Tbl_Tender.TenderNo,
          Tbl_Tender.TenderName,
          Tbl_Tender.TenderDate,
          Tbl_Tender.AddCity,
          Tbl_Tender.BidEndDate,
          Tbl_Tender.TenderBased,
          Tbl_Tender_Vender_Calculation.AllocateStatus,
          Tbl_Tender_Vender_Calculation.Vend_id
        FROM Tbl_Tender
        INNER JOIN Tbl_Tender_Vender_Calculation
        ON Tbl_Tender.TenderNo = Tbl_Tender_Vender_Calculation.TenderNumber
        WHERE Tbl_Tender_Vender_Calculation.AllocateStatus = 'Rejected' AND   Tbl_Tender_Vender_Calculation.Vend_id=@vendorID
      `);

    const rejectedTenders = result.recordset;
    const rejectedCount = rejectedTenders.length;

    res.json({ rejectedTenders, rejectedCount });
  } catch (error) {
    console.error("Error executing SQL query", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/submittedqueans/:vendorID/:TenderNo", async (req, res) => {
  const TenderNo = req.params.TenderNo;
  const vendorID = req.params.vendorID;

  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("vendorID", sql.Int, vendorID)
      .input("tenderNo", sql.NVarChar, TenderNo)
      .query(
        "SELECT * FROM Tbl_Tender_Vender_Mapping WHERE TenderNumber = @tenderNo And Vend_id=@vendorID"
      );

    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching tender questions:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
  "/api/submitanswers/:tenderNumber/:vendorId",
  upload.array("file", 10),
  async (req, res) => {
    try {
      const { tenderNumber, vendorId } = req.params;
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
      INSERT INTO Tbl_Tender_Vender_Mapping ( Vend_id, TenderNumber, Tend_Que, Tend_Ans, Doc_File, Doc_Filepath, Status, CreateDate, UpdateDate, LogInType)
      VALUES ( @VendorID, @TenderNumber, @Tend_Que, @Tend_Ans, @Doc_File, @Doc_Filepath, @Status, @CreateDate, @UpdateDate, @LogInType);
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
            .input("VendorID", sql.Int, vendorId)
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

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/getinvoicedetail/:InvoiceNo", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("InvoiceNo", sql.NVarChar(200), req.params.InvoiceNo).query(`
        SELECT
          Tbl_Invoice.InvoiceNo,
          Tbl_Invoice.ID,
          Tbl_Invoice.ShiP_To,
          Tbl_Invoice.Bill_To,
          Tbl_Invoice.Status,
          Tbl_Invoice.SubCostTotalAmont,
          Tbl_Invoice.InvoiceTotalAmont,
          Tbl_Invoice.TotalAmount,
          Tbl_Invoice.TotalDicountAmont,
          Tbl_Invoice.AdjustmentCost,

          Tbl_Invoice_Cilent_Mapping.Client_Note,
          Tbl_Invoice_Cilent_Mapping.Term_Condition,
          Tbl_Invoice_Cilent_Mapping.Filename,
          Tbl_Invoice_Cilent_Mapping.Filepath,

          Tbl_InvoiceItem.Description,
          Tbl_InvoiceItem.Item,
          Tbl_InvoiceItem.Qnty,
          Tbl_InvoiceItem.Tax,
          Tbl_InvoiceItem.Rate,
          Tbl_InvoiceItem.TotalAmont,
          Tbl_InvoiceItem.TaxName,

          Tbl_InvoiceTaxCal.TaxValues,
          Tbl_InvoiceTaxCal.TaxName
        FROM
          Tbl_Invoice
        INNER JOIN Tbl_Invoice_Cilent_Mapping ON Tbl_Invoice.ID = Tbl_Invoice_Cilent_Mapping.InvoiceID
        INNER JOIN Tbl_InvoiceItem ON Tbl_Invoice.InvoiceNo = Tbl_InvoiceItem.InvoiceNumber 
        INNER JOIN Tbl_InvoiceTaxCal ON Tbl_Invoice.InvoiceNo = Tbl_InvoiceTaxCal.InvoiceNumber 
        WHERE
          Tbl_Invoice.InvoiceNo = @InvoiceNo;
      `);

    if (result.recordset.length === 0) {
      res.status(404).json({ message: "Invoice not found" });
    } else {
      const invoiceDetails = result.recordset[0];

      // Fetch file details
      const fileResult = await pool
        .request()
        .input("InvoiceID", sql.Int, invoiceDetails.ID).query(`
        SELECT
          Filename,
          Filepath
        FROM
          Tbl_Invoice_Cilent_Mapping
        WHERE
          InvoiceID = @InvoiceID;
      `);

      if (fileResult.recordset.length > 0) {
        invoiceDetails.fileDetails = fileResult.recordset[0];
      }

      // Fetch items
      const itemsResult = await pool
        .request()
        .input("InvoiceNumber", sql.NVarChar(200), req.params.InvoiceNo).query(`
          SELECT
            Description,
            Item,
            Qnty,
            Tax,
            Rate,
            TotalAmont,
            TaxName
          FROM
            Tbl_InvoiceItem
          WHERE
            InvoiceNumber = @InvoiceNumber;
        `);

      // Fetch tax details
      const taxDetailsResult = await pool
        .request()
        .input("InvoiceNumber", sql.NVarChar(200), req.params.InvoiceNo).query(`
          SELECT
            TaxName,
            TaxValues
          FROM
            Tbl_InvoiceTaxCal
          WHERE
            InvoiceNumber = @InvoiceNumber;
        `);

      invoiceDetails.items = itemsResult.recordset;
      invoiceDetails.taxDetails = taxDetailsResult.recordset;

      res.json(invoiceDetails);
    }
  } catch (error) {
    console.error("Error fetching invoice data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/getinvoice/:vendorId", async (req, res) => {
  const { vendorId } = req.params;
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("vendorId", sql.Int, vendorId)
      .query("SELECT * FROM Tbl_Invoice WHERE vender_id = @vendorId");
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching invoice data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/getestimatedetail/:EstimateNo", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("EstimateNo", sql.NVarChar(200), req.params.EstimateNo).query(`
        SELECT
          Tbl_Estimate.EstimateNo,
          Tbl_Estimate.ID,
          Tbl_Estimate.ShiP_To,
          Tbl_Estimate.Bill_To,
          Tbl_Estimate.Status,
          Tbl_Estimate.SubCostTotalAmont,
          Tbl_Estimate.InvoiceTotalAmont,
          Tbl_Estimate.TotalAmount,
          Tbl_Estimate.TotalDicountAmont,
          Tbl_Estimate.AdjustmentCost,


          Tbl_Estimate_Cilent_Mapping.Client_Note,
          Tbl_Estimate_Cilent_Mapping.Term_condition,
          Tbl_Estimate_Cilent_Mapping.Filename,
          Tbl_Estimate_Cilent_Mapping.Filepath,


          Tbl_EstimateItem.Description,
          Tbl_EstimateItem.Item,
          Tbl_EstimateItem.Qnty,
          Tbl_EstimateItem.Tax,
          Tbl_EstimateItem.Rate,
          Tbl_EstimateItem.TotalAmont,
          Tbl_EstimateItem.TaxName,

          Tbl_EstimateTaxCal.TaxValues,
          Tbl_EstimateTaxCal.TaxName

        FROM
          Tbl_Estimate
        INNER JOIN Tbl_Estimate_Cilent_Mapping ON Tbl_Estimate.ID = Tbl_Estimate_Cilent_Mapping.EstimateID
        INNER JOIN Tbl_EstimateItem ON Tbl_Estimate.EstimateNo = Tbl_EstimateItem.EstimateNumber 
        INNER JOIN Tbl_EstimateTaxCal ON Tbl_Estimate.EstimateNo = Tbl_EstimateTaxCal.EstimateNumber 
        WHERE
        Tbl_Estimate.EstimateNo = @EstimateNo;
      `);

    if (result.recordset.length === 0) {
      res.status(404).json({ message: "Estimate not found" });
    } else {
      const estimateDetails = result.recordset[0];
      const itemsResult = await pool
        .request()
        .input("EstimateNumber", sql.NVarChar(200), req.params.EstimateNo)
        .query(`
          SELECT
            Description,
            Item,
            Qnty,
            Tax,
            Rate,
            TotalAmont,
            TaxName
          FROM
            Tbl_EstimateItem
          WHERE
          EstimateNumber = @EstimateNumber;
        `);
      // Fetch file details
      const fileResult = await pool
        .request()
        .input("EstimateID", sql.Int, estimateDetails.ID).query(`
   SELECT
     Filename,
     Filepath
   FROM
     Tbl_Estimate_Cilent_Mapping
   WHERE
   EstimateID = @EstimateID;
 `);

      if (fileResult.recordset.length > 0) {
        estimateDetails.fileDetails = fileResult.recordset[0];
      }

      const taxDetailsResult = await pool
        .request()
        .input("EstimateNumber", sql.NVarChar(200), req.params.EstimateNo)
        .query(`
          SELECT
            TaxName,
            TaxValues
          FROM
            Tbl_EstimateTaxCal
          WHERE
          EstimateNumber = @EstimateNumber;
        `);

      estimateDetails.items = itemsResult.recordset;
      estimateDetails.taxDetails = taxDetailsResult.recordset;

      res.json(estimateDetails);
    }
  } catch (error) {
    console.error("Error fetching Estimate data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/getestimate/:vendorId", async (req, res) => {
  const { vendorId } = req.params;
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("vendorId", sql.Int, vendorId)
      .query("SELECT * FROM Tbl_Estimate WHERE vender_id = @vendorId");
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching invoice data:", error);
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
      .input("venderId", sql.NVarChar, raiseId)
      .query(
        "SELECT email FROM Tbl_contactsVendor WHERE vender_id = @venderId"
      );

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

app.get("/api/vendor-details/:vendorId", async (req, res) => {
  const { vendorId } = req.params;
  try {
    // Connect to the database
    const pool = await sql.connect(config);
    const result = await pool.request().input("vendorId", sql.Int, vendorId)
      .query`SELECT * FROM Tbl_Vendor WHERE Vend_ID = @vendorId`;
    // Send the result as JSON
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching vendor details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/supportitem/:vendorId", async (req, res) => {
  const { vendorId } = req.params;

  try {
    const result = await pool
      .request()
      .input("vendorId", sql.Int, vendorId)
      .query("SELECT * FROM Tbl_Support_Ticket WHERE Raise_ID = @vendorId");

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

app.get("/api/workorder-tenders/:vendorID", async (req, res) => {
  try {
    const { vendorID } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()

      .input("vendorID", sql.Int, vendorID).query(`
        SELECT * FROM Tbl_Work_Order_Calculation WHERE OrderPublish = 1 AND  Vend_id=@vendorID AND Accepted = 0 AND Declined=0 AND Canceled=0
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
  "/api/workorder-tenders-page/:WorkOrderNumber/:vendorID",
  async (req, res) => {
    try {
      const { WorkOrderNumber } = req.params;
      const { vendorID } = req.params;
      const pool = await sql.connect(config);
      const result = await pool
        .request()
        .input("WorkOrderNumber", sql.NVarChar, WorkOrderNumber)
        .input("vendorID", sql.Int, vendorID).query(`
        SELECT * FROM Tbl_Work_Order_Calculation WHERE  Vend_id=@vendorID AND WorkOrderNumber=@WorkOrderNumber
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

app.put("/api/workorderAccept/:WorkOrderNumber/:vendorID", async (req, res) => {
  const { WorkOrderNumber, vendorID } = req.params;

  try {
    const result = await pool
      .request()
      .input("WorkOrderNumber", sql.VarChar, WorkOrderNumber)
      .input("vendorID", sql.Int, vendorID).query(`
        UPDATE [dbo].[Tbl_Work_Order_Calculation]
        SET Accepted = 1
        WHERE WorkOrderNumber = @WorkOrderNumber AND Vend_id=@vendorID
      `);

    if (result.rowsAffected[0] === 1) {
      res.json({ success: true, message: "Accepted updated successfully" });
    } else {
      res.status(404).json({ success: false, message: "Work order not found" });
    }
  } catch (error) {
    console.error("Error updating Accepted column:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/acceptedworkorder/:vendorID", async (req, res) => {
  try {
    const { vendorID } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()

      .input("vendorID", sql.Int, vendorID).query(`
        SELECT *  FROM Tbl_Work_Order_Calculation
        WHERE Accepted = 1 AND Vend_id=@vendorID
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
  "/api/workorder-declined/:WorkOrderNumber/:vendorID",
  async (req, res) => {
    const { WorkOrderNumber, vendorID } = req.params;
    const { reason } = req.body;

    try {
      await pool
        .request()
        .input("vendorID", sql.Int, vendorID)
        .input("WorkOrderNumber", sql.NVarChar, WorkOrderNumber)
        .input("reason", sql.NVarChar, reason)
        .query(
          "UPDATE Tbl_Work_Order_Calculation SET Declined_Reason = @reason, Declined = 1 WHERE WorkOrderNumber = @WorkOrderNumber AND Vend_id=@vendorID"
        );

      res.status(200).json({ message: "Work order rejected successfully" });
    } catch (error) {
      console.error("Error rejecting work order:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.get("/api/declinedworkorder/:vendorID", async (req, res) => {
  try {
    const { vendorID } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()

      .input("vendorID", sql.Int, vendorID).query(`
        SELECT *  FROM Tbl_Work_Order_Calculation
        WHERE Declined = 1 AND Vend_id=@vendorID
      `);

    const declinedTenders = result.recordset;
    const declinedCount = declinedTenders.length;

    res.json({ declinedTenders, declinedCount });
  } catch (error) {
    console.error("Error executing SQL query", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/cancelledworkorder/:vendorID", async (req, res) => {
  try {
    const { vendorID } = req.params;
    const pool = await sql.connect(config);
    const result = await pool
      .request()

      .input("vendorID", sql.Int, vendorID).query(`
        SELECT *  FROM Tbl_Work_Order_Calculation
        WHERE Canceled = 1 AND Vend_id=@vendorID
      `);

    const cancelledTenders = result.recordset;
    const cancelledCount = cancelledTenders.length;

    res.json({ cancelledTenders, cancelledCount });
  } catch (error) {
    console.error("Error executing SQL query", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/getsentinvoice/:vendorId", async (req, res) => {
  const { vendorId } = req.params;
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().input("vendorId", sql.Int, vendorId)
      .query(`
        SELECT ci.*, sc.GrandTotalAmount
        FROM Tbl_createinvoices ci
        INNER JOIN Tbl_shipping_calculations sc ON ci.invoice_number = sc.invoice_number
        WHERE ci.vendor_id = @vendorId
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching invoice data:", error);
    res.status(500).send("Internal Server Error");
  }
});
app.get(
  "/api/getsentinvoiceclient/:venderId/:invoice_number",
  async (req, res) => {
    const { invoice_number, venderId } = req.params;
    try {
      const pool = await sql.connect(config);
      const result = await pool
        .request()
        .input("vendorId", sql.Int, venderId)
        .input("invoice_number", sql.NVarChar, invoice_number).query(`
        SELECT * FROM Tbl_client WHERE vendor_id = @vendorId And invoice_number=@invoice_number
      `);
      res.json(result.recordset);
    } catch (error) {
      console.error("Error fetching invoice data:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);
app.get(
  "/api/getsentinvoicebuisness/:venderId/:invoice_number",
  async (req, res) => {
    const { invoice_number, venderId } = req.params;
    try {
      const pool = await sql.connect(config);
      const result = await pool
        .request()
        .input("vendorId", sql.Int, venderId)
        .input("invoice_number", sql.NVarChar, invoice_number).query(`
        SELECT * FROM Tbl_business WHERE vendor_id = @vendorId And invoice_number=@invoice_number
      `);
      res.json(result.recordset);
    } catch (error) {
      console.error("Error fetching invoice data:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.use(bodyParser.json({ limit: "10mb", extended: true }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

app.post("/api/createInvoice", async (req, res) => {
  const { invoiceDate, dueDate, logoUrl, vendor_id, invoiceNumber } = req.body;

  if (!vendor_id || !invoiceDate || !dueDate || !invoiceNumber) {
    return res.status(400).json({
      error:
        "Vendor ID, invoice date, due date, and invoice number are required.",
    });
  }

  let parsedInvoiceDate;
  let parsedDueDate;
  try {
    parsedInvoiceDate = new Date(invoiceDate).toISOString().split("T")[0];
    parsedDueDate = new Date(dueDate).toISOString().split("T")[0];
  } catch (error) {
    console.error("Error parsing dates:", error);
    return res.status(400).json({
      error: "Invalid date format. Dates must be in YYYY-MM-DD format.",
    });
  }

  try {
    const request = pool.request();
    const result = await request
      .input("invoiceDate", parsedInvoiceDate)
      .input("dueDate", parsedDueDate)
      .input("logoUrl", logoUrl)
      .input("vendor_id", vendor_id)
      .input("invoiceNumber", invoiceNumber)
      .query(
        `INSERT INTO Tbl_createinvoices (invoice_date, due_date, logo_url, vendor_id, invoice_number) 
        VALUES (@invoiceDate, @dueDate, @logoUrl, @vendor_id, @invoiceNumber);
        SELECT SCOPE_IDENTITY() AS ID, invoice_number FROM Tbl_createinvoices WHERE id = SCOPE_IDENTITY()`
      );
    const insertedInvoice = result.recordset[0];
    res.status(201).json({
      id: insertedInvoice.ID,
      invoiceNumber: insertedInvoice.invoice_number,
    });
  } catch (err) {
    console.error("Error creating invoice:", err);
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

app.get("/api/getNextInvoiceNumber", async (req, res) => {
  try {
    const request = pool.request();
    const result = await request.query(
      `SELECT ISNULL(MAX(CAST(SUBSTRING(invoice_number, 11, LEN(invoice_number) - 10) AS nvarchar)), 0) + 1 AS nextInvoiceNumber 
      FROM Tbl_createinvoices`
    );
    const nextInvoiceNumber = `24-02-IN-${String(
      result.recordset[0].nextInvoiceNumber
    ).padStart(6, "0")}`;
    res.status(200).json({ invoiceNumber: nextInvoiceNumber });
  } catch (err) {
    console.error("Error fetching next invoice number:", err);
    res.status(500).json({ error: "Failed to fetch next invoice number" });
  }
});

app.post("/api/createBusiness", async (req, res) => {
  const {
    name,
    address,
    email,
    phone,
    city,
    zipCode,
    state,
    panCard,
    gst,
    vendor_id,
    invoiceNumber,
  } = req.body;

  if (!vendor_id) {
    return res.status(400).json({ error: "Vendor ID is required." });
  }

  try {
    const request = pool.request();
    const result = await request
      .input("name", name)
      .input("address", address)
      .input("email", email)
      .input("phone", phone)
      .input("city", city)
      .input("zipCode", zipCode)
      .input("state", state)
      .input("panCard", panCard)
      .input("gst", gst)
      .input("vendor_id", vendor_id)
      .input("invoiceNumber", invoiceNumber)
      .query(
        `INSERT INTO Tbl_business (name, address, email, phone, city, zipCode, state, panCard, gst, vendor_id, invoice_number) 
        VALUES (@name, @address, @email, @phone, @city, @zipCode, @state, @panCard, @gst, @vendor_id, @invoiceNumber);
        SELECT SCOPE_IDENTITY() AS ID`
      );
    res.status(201).json({ id: result.recordset[0].ID });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send("Server Error");
  }
});

app.post("/api/createClient", async (req, res) => {
  const {
    name,
    address,
    email,
    phone,
    city,
    zipCode,
    state,
    panCard,
    gst,
    vendor_id,
    invoiceNumber,
  } = req.body;

  if (!vendor_id) {
    return res.status(400).json({ error: "Vendor ID is required." });
  }

  try {
    const request = pool.request();
    const result = await request
      .input("name", name)
      .input("address", address)
      .input("email", email)
      .input("phone", phone)
      .input("city", city)
      .input("zipCode", zipCode)
      .input("state", state)
      .input("panCard", panCard)
      .input("gst", gst)
      .input("vendor_id", vendor_id)
      .input("invoiceNumber", invoiceNumber)
      .query(
        `INSERT INTO Tbl_client (name, address, email, phone, city, zipCode, state, panCard, gst, vendor_id, invoice_number) 
        VALUES (@name, @address, @email, @phone, @city, @zipCode, @state, @panCard, @gst, @vendor_id, @invoiceNumber);
        SELECT SCOPE_IDENTITY() AS ID`
      );
    res.status(201).json({ id: result.recordset[0].ID });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send("Server Error");
  }
});

app.post("/api/addShipping", async (req, res) => {
  const { items, invoiceNumber } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ error: "Items array is required and must not be empty." });
  }

  const insertQuery =
    "INSERT INTO Tbl_shipping_details (Item, Description, Qnty, Rate, Tax1Name, Tax1Rate, Tax2Name, Tax2Rate, TotalAmount, invoice_number) VALUES ";

  try {
    const values = items.map((item) => {
      const totalAmount = item.Qnty * item.Rate;
      return `('${item.Item}', '${item.Description}', ${item.Qnty}, ${item.Rate}, '${item.Tax1Name}', ${item.Tax1Rate}, '${item.Tax2Name}', ${item.Tax2Rate}, ${totalAmount}, '${invoiceNumber}')`;
    });

    const queryValues = values.join(", ");

    const fullQuery = insertQuery + queryValues;

    console.log("Full Query:", fullQuery);

    const result = await pool.query(fullQuery);

    console.log("Shipping details saved successfully");
    res.status(201).json({
      message: "Shipping details saved successfully",
      rowsAffected: result.affectedRows,
    });
  } catch (err) {
    console.error("Error saving shipping details:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

app.post("/api/shippingcalculations", async (req, res) => {
  const { items, invoiceNumber } = req.body; // Include invoiceNumber in the request body

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ error: "Items array is required and must not be empty." });
  }

  const insertQuery =
    "INSERT INTO Tbl_shipping_calculations(TotalItemAmount, TotalTaxAmount, GrandTotalAmount, invoice_number) VALUES ";

  try {
    // Map items to values for bulk insert
    const values = items.map((item) => {
      // Ensure these properties are correctly named in your items
      const { TotalItemAmount, TotalTaxAmount, GrandTotalAmount } = item;
      return `(${TotalItemAmount}, ${TotalTaxAmount}, ${GrandTotalAmount}, '${invoiceNumber}')`;
    });

    const queryValues = values.join(", ");
    const fullQuery = insertQuery + queryValues;

    console.log("Full Query:", fullQuery); // Log the full query for debugging

    // Execute the insert query
    const result = await pool.query(fullQuery);

    console.log("Shipping calculations saved successfully");
    res.status(201).json({
      message: "Shipping calculations saved successfully",
      rowsAffected: result.affectedRows,
    });
  } catch (err) {
    console.error("Error saving shipping calculations:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

app.get("/api/getinvoiceclientitems/:invoice_number", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("invoice_number", sql.NVarChar(200), req.params.invoice_number)
      .query(`
        SELECT
         
        Tbl_shipping_calculations.TotalItemAmount,
        Tbl_shipping_calculations.TotalTaxAmount,
        Tbl_shipping_calculations.GrandTotalAmount,
      
         
          Tbl_shipping_details.Description,
          Tbl_shipping_details.Item,
          Tbl_shipping_details.Qnty,
          Tbl_shipping_details.TotalAmount,
        
          Tbl_shipping_details.Rate,
          Tbl_shipping_details.Tax1Name,
          Tbl_shipping_details.Tax2Name,
          Tbl_shipping_details.Tax2Rate,
          Tbl_shipping_details.Tax1Rate
   
      
        FROM Tbl_shipping_calculations
        INNER JOIN  Tbl_shipping_details ON Tbl_shipping_calculations.invoice_number =  Tbl_shipping_details.invoice_number 
        WHERE
        Tbl_shipping_calculations.invoice_number = @invoice_number;
      `);

    if (result.recordset.length === 0) {
      res.status(404).json({ message: "Invoice not found" });
    } else {
      const invoiceDetails = result.recordset[0];

      // Fetch items
      const itemsResult = await pool
        .request()
        .input("invoice_number", sql.NVarChar(200), req.params.invoice_number)
        .query(`
          SELECT
            Description,
            Item,
            Qnty,
            Rate,
            Tax1Name,
            Tax1Rate,
            Tax2Name,
            TotalAmount,
            Tax2Rate
         
          FROM
          Tbl_shipping_details
          WHERE
          invoice_number = @invoice_number;
        `);

      invoiceDetails.items = itemsResult.recordset;

      res.json(invoiceDetails);
    }
  } catch (error) {
    console.error("Error fetching invoice data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get(
  "/api/getInvoiceDetails/:vendorId/:invoice_number",
  async (req, res) => {
    const { invoice_number, vendorId } = req.params;
    console.log("Invoice Number:", invoice_number);
    console.log("Vendor ID:", vendorId);

    try {
      const pool = await sql.connect(config);
      const result = await pool
        .request()
        .input("invoice_number", sql.NVarChar(200), invoice_number)
        .input("vendor_id", sql.Int, vendorId).query(`
        SELECT *
        FROM Tbl_createinvoices
        WHERE invoice_number = @invoice_number
          AND vendor_id = @vendor_id;
      `);

      if (result.recordset.length === 0) {
        res
          .status(404)
          .json({ message: "Invoice not found for the specified vendor" });
      } else {
        res.json(result.recordset[0]);
      }
    } catch (error) {
      console.error("Error fetching invoice data:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.get(
  "/api/getBusinessDetails/:vendorId/:invoice_number",
  async (req, res) => {
    const { vendorId, invoice_number } = req.params;
    try {
      const pool = await sql.connect(config);
      const result = await pool
        .request()
        .input("vendor_id", sql.Int, vendorId)
        .input("invoice_number", sql.NVarChar, invoice_number).query(`
        SELECT *
        FROM Tbl_business
        WHERE vendor_id = @vendor_id AND invoice_number=@invoice_number
      `);

      if (result.recordset.length === 0) {
        res.status(404).json({
          message: "Business data not found for the specified vendor",
        });
      } else {
        res.json(result.recordset[0]);
      }
    } catch (error) {
      console.error("Error fetching business data:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.get("/api/getClientDetails/:vendorId/:invoice_number", async (req, res) => {
  const { vendorId, invoice_number } = req.params;
  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("vendor_id", sql.Int, vendorId)
      .input("invoice_number", sql.NVarChar, invoice_number).query(`
        SELECT *
        FROM Tbl_client
        WHERE vendor_id = @vendor_id AND invoice_number=@invoice_number
      `);

    if (result.recordset.length === 0) {
      res
        .status(404)
        .json({ message: "Client data not found for the specified vendor" });
    } else {
      res.json(result.recordset[0]);
    }
  } catch (error) {
    console.error("Error fetching client data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/getItemsAndCalculations/:invoice_number", async (req, res) => {
  const { invoice_number } = req.params;
  try {
    const pool = await sql.connect(config);
    const itemsResult = await pool
      .request()

      .input("invoice_number", sql.NVarChar(200), invoice_number).query(`
        SELECT *
        FROM Tbl_shipping_details
        WHERE invoice_number = @invoice_number;
      `);

    const calculationsResult = await pool
      .request()

      .input("invoice_number", sql.NVarChar(200), invoice_number).query(`
        SELECT *
        FROM Tbl_shipping_calculations
        WHERE invoice_number = @invoice_number;
      `);

    if (
      itemsResult.recordset.length === 0 ||
      calculationsResult.recordset.length === 0
    ) {
      res.status(404).json({
        message:
          "Items or calculation data not found for the specified invoice",
      });
    } else {
      const items = itemsResult.recordset;
      const calculations = calculationsResult.recordset[0];
      res.json({ items, calculations });
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.put("/api/updateItemsAndCalculations/:invoiceNumber", async (req, res) => {
  const { invoiceNumber } = req.params;
  const { items, calculations } = req.body;

  if (!Array.isArray(items) || items.length === 0 || !calculations) {
    return res
      .status(400)
      .json({ error: "Items array and calculations data are required." });
  }

  try {
    const pool = await sql.connect(config);

    const updateItemsPromises = items.map(async (item) => {
      await pool
        .request()
        .input("description", sql.NVarChar(255), item.description)
        .input("item", sql.NVarChar(100), item.item)
        .input("qnty", sql.Int, item.qnty)
        .input("rate", sql.Decimal(10, 2), item.rate)
        .input("tax1Name", sql.NVarChar(100), item.tax1Name)
        .input("tax1Rate", sql.Decimal(10, 2), item.tax1Rate)
        .input("tax2Name", sql.NVarChar(100), item.tax2Name)
        .input("tax2Rate", sql.Decimal(10, 2), item.tax2Rate)
        .input("totalAmount", sql.Decimal(10, 2), item.totalAmount)
        .input("invoiceNumber", sql.NVarChar(200), item.invoiceNumber).query(`
        UPDATE Tbl_shipping_details
        SET Description = @description,
            Item = @item,
            Qnty = @qnty,
            Rate = @rate,
            Tax1Name = @tax1Name,
            Tax1Rate = @tax1Rate,
            Tax2Name = @tax2Name,
            Tax2Rate = @tax2Rate,
            TotalAmount = @totalAmount
        WHERE invoice_number = @invoiceNumber;
      `);
    });

    await Promise.all(updateItemsPromises);

    await pool
      .request()
      .input(
        "totalItemAmount",
        sql.Decimal(18, 2),
        calculations.totalItemAmount
      )
      .input("totalTaxAmount", sql.Decimal(18, 2), calculations.totalTaxAmount)
      .input(
        "grandTotalAmount",
        sql.Decimal(18, 2),
        calculations.grandTotalAmount
      )
      .input("invoiceNumber", sql.NVarChar(200), invoiceNumber).query(`
        UPDATE Tbl_shipping_calculations
        SET TotalItemAmount = @totalItemAmount,
            TotalTaxAmount = @totalTaxAmount,
            GrandTotalAmount = @grandTotalAmount
        WHERE invoice_number = @invoiceNumber;
      `);

    res
      .status(200)
      .json({ message: "Items and calculations updated successfully" });
  } catch (error) {
    console.error("Error updating data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.put("/api/updateInvoice/:vendorId/:invoice_number", async (req, res) => {
  const { invoice_number, vendorId } = req.params;
  const {
    invoiceDate,
    dueDate,
    logoUrl,
    invoice_number: newInvoiceNumber,
  } = req.body;

  // Check if required fields are provided
  if (!invoiceDate || !dueDate || !logoUrl || !newInvoiceNumber) {
    return res.status(400).json({
      error:
        "Invoice date, due date, logo URL, and new invoice number are required.",
    });
  }

  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("invoiceDate", sql.DateTime, new Date(invoiceDate))
      .input("dueDate", sql.DateTime, new Date(dueDate))
      .input("logoUrl", sql.NVarChar(255), logoUrl)
      .input("newInvoiceNumber", sql.NVarChar(50), newInvoiceNumber)
      .input("invoice_number", sql.NVarChar(50), invoice_number)
      .input("vendorId", sql.Int, vendorId).query(`
        UPDATE Tbl_createinvoices
        SET invoice_date = @invoiceDate,
            due_date = @dueDate,
            logo_url = @logoUrl,
            invoice_number = @newInvoiceNumber
        WHERE invoice_number = @invoice_number
          AND vendor_id = @vendorId;
      `);

    res.status(200).json({ message: "Invoice updated successfully" });
  } catch (error) {
    console.error("Error updating invoice data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.put("/api/updateBusiness/:vendorId/:invoiceNumber", async (req, res) => {
  const { name, address, email, phone, city, zipCode, state, panCard, gst } =
    req.body;
  const { vendorId, invoiceNumber } = req.params;

  if (!vendorId || !invoiceNumber) {
    return res
      .status(400)
      .json({ error: "Vendor ID and invoice number are required." });
  }

  try {
    const request = pool.request();
    await request
      .input("name", name)
      .input("address", address)
      .input("email", email)
      .input("phone", phone)
      .input("city", city)
      .input("zipCode", zipCode)
      .input("state", state)
      .input("panCard", panCard)
      .input("gst", gst)
      .input("vendorId", vendorId)
      .input("invoiceNumber", invoiceNumber).query(`
        UPDATE Tbl_business 
        SET name = @name, address = @address, email = @email, phone = @phone, 
            city = @city, zipCode = @zipCode, state = @state, panCard = @panCard, 
            gst = @gst 
        WHERE vendor_id = @vendorId AND invoice_number = @invoiceNumber;
      `);
    res.status(200).send("Business details updated successfully.");
  } catch (err) {
    console.error("Error updating business details:", err);
    res.status(500).send("Server Error");
  }
});

app.put("/api/updateClient/:vendorId/:invoiceNumber", async (req, res) => {
  const { name, address, email, phone, city, zipCode, state, panCard, gst } =
    req.body;
  const { vendorId, invoiceNumber } = req.params;

  if (!vendorId || !invoiceNumber) {
    return res
      .status(400)
      .json({ error: "Vendor ID and invoice number are required." });
  }

  try {
    const request = pool.request();
    await request
      .input("name", name)
      .input("address", address)
      .input("email", email)
      .input("phone", phone)
      .input("city", city)
      .input("zipCode", zipCode)
      .input("state", state)
      .input("panCard", panCard)
      .input("gst", gst)
      .input("vendorId", vendorId)
      .input("invoiceNumber", invoiceNumber).query(`
        UPDATE Tbl_client 
        SET name = @name, address = @address, email = @email, phone = @phone, 
            city = @city, zipCode = @zipCode, state = @state, panCard = @panCard, 
            gst = @gst 
        WHERE vendor_id = @vendorId AND invoice_number = @invoiceNumber;
      `);
    res.status(200).send("Client details updated successfully.");
  } catch (err) {
    console.error("Error updating client details:", err);
    res.status(500).send("Server Error");
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// const config = {
//   user: 'fg_minterior',
//   password: '@J220a3qq',
//   server: '51.255.229.25',
//   database: 'lissom_minterior1'
// };
