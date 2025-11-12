const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();
const cron = require("node-cron");
app.use(bodyParser.json());
app.use(cors()); // Enable CORS
app.use(express.json());
git 
// ตั้งค่าการเชื่อมต่อ SQL Server1234
const dbConfig = {
    user: 'sa',
    password: 'Automatic',
    server: '172.23.10.39',
    database: 'ScadaReport',
    options: {
        encrypt: true, // สำหรับ Azure SQL Server, ตั้งค่าเป็น true
        trustServerCertificate: true // ใช้ในกรณีการเชื่อมต่อกับ SQL Server ท้องถิ่น
    }
};

// เชื่อมต่อกับฐานข้อมูล
sql.connect(dbConfig, (err) => {
    if (err) {
        console.error('Database connection failed: ', err);
    } else {
        console.log('Connected to the database');
    }
});

// API สำหรับการ login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        // ใช้ parameterized query เพื่อป้องกัน SQL Injection
        const result = await sql.query`
            SELECT * FROM E_StockUser 
            WHERE Username = ${username} AND Password = ${password}
        `;

        // ตรวจสอบว่ามีผู้ใช้งานที่ตรงกับ username และ password ที่ระบุหรือไม่
        if (result.recordset.length > 0) {
            // สร้างตัวแปร user ที่มีข้อมูลที่จำเป็นสำหรับการส่งกลับไปยัง client
            const user = {
                Id: result.recordset[0].Id,
                Username: result.recordset[0].Username,
                Name: result.recordset[0].Name,
                Section: result.recordset[0].Section,
                Branch: result.recordset[0].Branch,
                Roleid: result.recordset[0].Roleid
            };

            // ส่งข้อมูลผู้ใช้ที่ถูกต้องกลับไปยัง client
            res.json({ success: true, message: 'Login successful', user });
        } else {
            // ไม่พบผู้ใช้หรือรหัสผ่านไม่ถูกต้อง
            res.json({ success: false, message: 'Invalid username or password' });
        }
    } catch (err) {
        // หากเกิดข้อผิดพลาดในการสอบถามฐานข้อมูล
        console.error('Error executing SQL query:', err);
        res.status(500).send('Internal Server Error');
    }
});

// API สำหรับดึงข้อมูลจาก E_StockMat
app.get('/GETNAME', async (req, res) => {
    
    try {
        console.log("✅ GET /Chorm");
        const { Name } = req.query;
        console.log(req.query);
        const result = await sql.query`SELECT * FROM SOI8_RetainChorme WHERE Name = ${Name}`;
        if (result.recordset.length > 0) {
            console.log(result.recordset);
            res.json(result.recordset);
        } else {
            res.status(404).json({ message: 'No data found' });
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

app.get('/GETUNEG', async (req, res) => {
    
    try {
        console.log("✅ GET /Uneq");
        const { Uneq } = req.query;
        console.log(req.query);
        const result = await sql.query`SELECT * FROM SOI8_RetainSample WHERE Uneg = ${Uneq}`;
        if (result.recordset.length > 0) {
            console.log(result.recordset);
            res.json(result.recordset);
        } else {
            res.status(404).json({ message: 'No data found' });
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

app.get('/GETSAMP1', async (req, res) => {
    
    try {
        console.log("✅ GET /SAMP1");
        console.log(req.query);
        const Status = "Inprocess";
        const result = await sql.query`SELECT * FROM SOI8_RetainSample WHERE Status = ${Status} order by Id desc`;
        if (result.recordset.length > 0) {
            console.log(result.recordset);
            res.json(result.recordset);
        } else {
            res.status(404).json({ message: 'No data found' });
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

app.get('/GETSAMP2', async (req, res) => {
    
try {
    console.log("✅ GET /SAMP2");

    // ✅ ประกาศตัวแปร Test เป็นวันที่วันนี้ในรูปแบบ YYYY-MM-DD
    const today = new Date();
    const Test = today.toISOString().split('T')[0]; // เช่น "2026-09-30"

    console.log("Test =", Test);

    // ยิง SQL โดยใช้ตัวแปร Test
    const result = await sql.query`
        SELECT * FROM SOI8_RetainSample 
        WHERE Test1 = ${Test} OR Test2 = ${Test} OR Test3 = ${Test} OR Test4 = ${Test}
    `;

    if (result.recordset.length > 0) {
        console.log(result.recordset);
        res.json(result.recordset);
    } else {
        res.status(404).json({ message: 'No data found' });
    }
} catch (err) {
    console.error(err);
    res.status(500).send(err);
}

});

app.get('/GETSAMP3', async (req, res) => {
    
try {
    console.log("✅ GET /SAMP3");

    // ✅ ประกาศตัวแปร Expire เป็นวันที่วันนี้ (รูปแบบ YYYY-MM-DD)
    const today = new Date();
    const Expire = today.toLocaleDateString('sv-SE'); // เช่น "2026-09-30"

    console.log("Expire =", Expire);

    // 🔍 คิวรีข้อมูลจากฐานข้อมูล
    const result = await sql.query`
        SELECT * FROM SOI8_RetainSample 
        WHERE ExpireDate = ${Expire}
    `;

    if (result.recordset.length > 0) {
        console.log(result.recordset);
        res.json(result.recordset);
    } else {
        res.status(404).json({ message: 'No data found' });
    }
} catch (err) {
    console.error(err);
    res.status(500).send(err);
}

});

app.post('/SENTDATA', async (req, res) => {
    try {
        console.log("✅ POST /History called");

        const {
            Uneg,
            ProductName,
            ChemicalType,
            ChemicalPhysic,
            ProductionDate,
            Alert,
            ExpireDate,
            LocationKeep,
            LocationWaste,
            Pcs,
            InputData,
            Test1,
            AlertTest1,
            Test2,
            AlertTest2,
            Test3,
            AlertTest3,
            Test4,
            AlertTest4,
            Status

        } = req.body;

        // ตรวจสอบว่าข้อมูลครบไหม
        if (!ProductName || !ChemicalType) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const result = await sql.query`
            INSERT INTO [ScadaReport].[dbo].[SOI8_RetainSample]
            (
                [Uneg],
                [ProductName],
                [ChemicalType],
                [ChemicalPhysic],
                [ProductionDate],
                [Alert],
                [ExpireDate],
                [LocationKeep],
                [LocationWaste],
                [Pcs],
                [InputData],
                [Test1],
                [AlertTest1],
                [Test2],
                [AlertTest2],
                [Test3],
                [AlertTest3],
                [Test4],
                [AlertTest4],
                [Status]
            )
            VALUES (
                ${Uneg},
                ${ProductName},
                ${ChemicalType},
                ${ChemicalPhysic},
                ${ProductionDate},
                ${Alert},
                ${ExpireDate},
                ${LocationKeep},
                ${LocationWaste},
                ${Pcs},
                ${InputData},
                ${Test1},
                ${AlertTest1},
                ${Test2},
                ${AlertTest2},
                ${Test3},
                ${AlertTest3},
                ${Test4},
                ${AlertTest4},
                ${Status}
            );
        `;

        res.status(201).json({ message: "✅ Data inserted successfully" });
    } catch (err) {
        console.error("❌ Insert error:", err);
        res.status(500).send(err);
    }
});

// ==================== ตั้งค่า Microsoft 365 ====================
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: "es1_auto@thaiparker.co.th",
    pass: "Password2025",
  },
  tls: {
    ciphers: "SSLv3",
  },
});

// ตั้งเวลาให้ส่งเมลทุกวันเวลา 16:45
cron.schedule("45 16 * * *", async () => {
  try {
    console.log("🕓 กำลังส่งเมลอัตโนมัติ (16:45)...");

    const mailOptions = {
      from: "es1_auto@thaiparker.co.th",
      to: "teera@thaiparker.co.th",
      subject: "📩 รายงานอัตโนมัติ 16:45 น.",
      html: `
        <div style="font-family: Arial; padding: 10px;">
          <h3 style="color:#0078D7;">แจ้งเตือนจากระบบ</h3>
          <p>รายงานอัตโนมัติถูกส่งเวลา <b>16:45 น.</b></p>
          <p>📅 วันที่ส่ง: ${new Date().toLocaleString("th-TH")}</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ ส่งเมลเวลา 16:45 สำเร็จ");

  } catch (err) {
    console.error("❌ ส่งเมลเวลา 16:45 ไม่สำเร็จ:", err);
  }
});
// ==================== เริ่ม Server ====================
app.listen(3006, () => console.log("🚀 Server running on http://127.0.0.1:3006"));

// เริ่มต้นเซิร์ฟเวอร์
const PORT = 3006;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});