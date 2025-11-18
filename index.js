// ==================== Import Packages ====================
const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const cors = require('cors');
const nodemailer = require('nodemailer');
const cron = require("node-cron");
const net = require('net');
const transporter = require("./mailer");

// ==================== Express Setup ====================
const app = express();
app.use(cors());
app.use(bodyParser.json());

// ==================== Database Config ====================
const dbConfig = {
    user: 'sa',
    password: 'Automatic',
    server: '172.23.10.39',
    database: 'ScadaReport',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

function isToday(dateValue) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  if (isNaN(d)) return false; // ถ้าไม่ใช่ date → false
  const todayStr = new Date().toISOString().split("T")[0];
  const dateStr = d.toISOString().split("T")[0];
  return dateStr === todayStr;
}

// Connect to Database
sql.connect(dbConfig, (err) => {
    if (err) console.error('Database connection failed: ', err);
    else console.log('Connected to the database');
});

// ==================== API Routes ====================

// -------- Login API --------
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await sql.query`
            SELECT * FROM E_StockUser 
            WHERE Username = ${username} AND Password = ${password}
        `;

        if (result.recordset.length > 0) {
            const user = {
                Id: result.recordset[0].Id,
                Username: result.recordset[0].Username,
                Name: result.recordset[0].Name,
                Section: result.recordset[0].Section,
                Branch: result.recordset[0].Branch,
                Roleid: result.recordset[0].Roleid
            };
            res.json({ success: true, message: 'Login successful', user });
        } else {
            res.json({ success: false, message: 'Invalid username or password' });
        }
    } catch (err) {
        console.error('Error executing SQL query:', err);
        res.status(500).send('Internal Server Error');
    }
});

// -------- GET APIs --------
app.get('/GETNAME', async (req, res) => {
    try {
        const { Name } = req.query;
        const result = await sql.query`SELECT * FROM SOI8_RetainChorme WHERE Name = ${Name}`;
        if (result.recordset.length > 0) res.json(result.recordset);
        else res.status(404).json({ message: 'No data found' });
    } catch (err) {
        res.status(500).send(err);
    }
});

app.get('/GETUNEG', async (req, res) => {
    try {
        const { Uneq } = req.query;
        const result = await sql.query`SELECT * FROM SOI8_RetainSample WHERE Uneg = ${Uneq}`;
        if (result.recordset.length > 0) res.json(result.recordset);
        else res.status(404).json({ message: 'No data found' });
    } catch (err) {
        res.status(500).send(err);
    }
});

app.get('/GETSAMP1', async (req, res) => {
    try {
        const Status = "Inprocess";
        const result = await sql.query`SELECT * FROM SOI8_RetainSample WHERE Status = ${Status} order by Id desc`;
        if (result.recordset.length > 0) res.json(result.recordset);
        else res.status(404).json({ message: 'No data found' });
    } catch (err) {
        res.status(500).send(err);
    }
});

app.get('/GETSAMP2', async (req, res) => {
    try {
        const today = new Date();
        const Test = today.toISOString().split('T')[0];
        const result = await sql.query`
            SELECT * FROM SOI8_RetainSample 
            WHERE Test1 = ${Test} OR Test2 = ${Test} OR Test3 = ${Test} OR Test4 = ${Test}
        `;
        if (result.recordset.length > 0) res.json(result.recordset);
        else res.status(404).json({ message: 'No data found' });
    } catch (err) {
        res.status(500).send(err);
    }
});

app.get('/GETSAMP3', async (req, res) => {
    try {
        const today = new Date();
        const Expire = today.toLocaleDateString('sv-SE');
        const result = await sql.query`SELECT * FROM SOI8_RetainSample WHERE ExpireDate = ${Expire}`;
        if (result.recordset.length > 0) res.json(result.recordset);
        else res.status(404).json({ message: 'No data found' });
    } catch (err) {
        res.status(500).send(err);
    }
});

// -------- POST SENTDATA --------
app.post('/SENTDATA', async (req, res) => {
    try {
        const p = req.body;
        if (!p.ProductName || !p.ChemicalType) return res.status(400).json({ message: "Missing required fields" });

        await sql.query`
            INSERT INTO [ScadaReport].[dbo].[SOI8_RetainSample]
            ([Uneg],[ProductName],[ChemicalType],[ChemicalPhysic],[ProductionDate],[Alert],
             [ExpireDate],[LocationKeep],[LocationWaste],[Pcs],[InputData],
             [Test1],[AlertTest1],[Test2],[AlertTest2],[Test3],[AlertTest3],[Test4],[AlertTest4],[Status])
            VALUES (
                ${p.Uneg},${p.ProductName},${p.ChemicalType},${p.ChemicalPhysic},${p.ProductionDate},
                ${p.Alert},${p.ExpireDate},${p.LocationKeep},${p.LocationWaste},${p.Pcs},${p.InputData},
                ${p.Test1},${p.AlertTest1},${p.Test2},${p.AlertTest2},${p.Test3},${p.AlertTest3},${p.Test4},${p.AlertTest4},${p.Status}
            );
        `;
        res.status(201).json({ message: "✅ Data inserted successfully" });
    } catch (err) {
        console.error("❌ Insert error:", err);
        res.status(500).send(err);
    }
});

// ==================== Print API ====================
app.post('/print', async (req, res) => {
  try {
    const p = req.body;
    if (!p.Uneg) return res.status(400).json({ message: "Missing Uneg" });

    const zpl = `
^XA
^PW1116
^LL780
^CF0,45

// ==========================
// วาดตาราง
// ==========================
^FO15,15^GB1086,750,5^FS \\Main
^FO15,15^GB635,220,5^FS \\productname
^FO645,15^GB455,150,5^FS \\chemical type
^FO645,160^GB455,160,5^FS \\input data
^FO15,665^GB317.5,100,5^FS
^FO15,665^GB635,100,5^FS
^FO15,540^GB317.5,130,5^FS
^FO15,540^GB635,130,5^FS
^FO645,314^GB455,450,5^FS \\qr code

// ==========================
// วางข้อความฟิลด์
// ==========================
^CF0,30,30
^FO25,30^FDProductName^FS
^FO655,30^FDChemicalType^FS
^FO655,175^FDInput by^FS
^FO25,680^FDProductionDate^FS
^FO340,680^FDExpireDate^FS
^FO25,555^FDLocationKeep^FS
^FO340,555^FDLocationWaste^FS

^FO710,330
^BQN,2,16
^FDLA,${p.Uneg}^FS

^CF0,35                
^FO730,700               
^FD${p.Uneg}^FS

// ==========================
// วางข้อมูล Item
// ==========================
^CF0,35
^FO70,725^FD${p.ProductionDate || '-'}^FS
^FO390,725^FD${p.ExpireDate || '-'}^FS
^FO70,620^FD${p.LocationKeep || '-'}^FS
^CF0,35
^FO370,590
^FB250,2,0,L,0
^FD${p.LocationWaste || '-'}^FS

^CF0,60 
^FO40,100^FD${p.ProductName || '-'}^FS
^FO710,100^FD${p.ChemicalType|| '-'}^FS
^FO710,255^FD${p.InputData|| '-'}^FS       

// ==========================
// เพิ่ม Test 90/180/270/365 Day
// ==========================
^CF0,35
^FO150,300^FDTest 90 Day: ${p.Test1 || '-'}^FS
^FO150,350^FDTest 180 Day: ${p.Test2 || '-'}^FS
^FO150,400^FDTest 270 Day: ${p.Test3 || '-'}^FS
^FO150,450^FDTest 365 Day: ${p.Test4 || '-'}^FS

^XZ
`;


    // 🔹 พิมพ์ ZPL string ลง console ก่อนส่ง
    console.log("📤 ZPL string ที่จะส่งไปเครื่องพิมพ์:\n", zpl);

    const PRINTER_IP = "172.26.20.3";
    const PRINTER_PORT = 9100;
    const client = new net.Socket();

    client.connect(PRINTER_PORT, PRINTER_IP, () => {
      client.write(zpl);
      client.end();
      console.log(`✅ ส่ง ZPL ไปเครื่องพิมพ์สำเร็จ: ${p.Uneg}`);
      res.status(200).json({ success: true, message: "Printed successfully", Uneg: p.Uneg });
    });

    client.on("error", (err) => {
      console.error("❌ ส่ง ZPL ไม่สำเร็จ:", err);
      res.status(500).json({ success: false, message: err.message });
    });

  } catch (err) {
    console.error("❌ /print error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});


// ==================== Nodemailer + Cron ====================
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: { user: "es1_auto@thaiparker.co.th", pass: "Password2025" },
  tls: { ciphers: "SSLv3" }
});

cron.schedule("00 09 * * *", async () => {
  try {
    console.log("🚀 เริ่มทำงาน CRON 09:00 น.");

    // Query SQL เอาทุก Item
    const result = await sql.query(`
      SELECT [Uneg],[ProductName],[ChemicalType],[ChemicalPhysic],
             [ProductionDate],[Alert],[ExpireDate],[LocationKeep],
             [LocationWaste],[Pcs],[InputData],[Test1],[AlertTest1],
             [Test2],[AlertTest2],[Test3],[AlertTest3],
             [Test4],[AlertTest4],[Remark],[Status]
      FROM [ScadaReport].[dbo].[SOI8_RetainSample]
    `);

    // เลือกเฉพาะรายการที่ Alert วันนี้
    const todayItems = result.recordset.filter(item =>
      isToday(item.Alert) ||
      isToday(item.AlertTest1) ||
      isToday(item.AlertTest2) ||
      isToday(item.AlertTest3) ||
      isToday(item.AlertTest4)
    );

    // ถ้าไม่มีรายการวันนี้ ส่งเมลแบบไม่มีข้อมูล
    if (todayItems.length === 0) {
      const mailOptions = {
        from: "es1_auto@thaiparker.co.th",
        to: "teera@thaiparker.co.th",
        subject: "📩 รายงาน Alert วันนี้ (ไม่มีรายการถึงกำหนด)",
        html: `<p>วันนี้ไม่มีรายการที่ถึงกำหนด Alert</p>`,
      };
      await transporter.sendMail(mailOptions);
      console.log("📭 ส่งเมล (ไม่มีรายการ) สำเร็จ");
      return;
    }

    // สร้าง HTML Table
    let htmlTable = `
      <h3>📌 รายการที่ถึงกำหนด Alert วันนี้ (${new Date().toLocaleDateString("th-TH")})</h3>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; font-family: Arial;">
        <tr style="background:#0078D7; color:white;">
          <th>Uneg</th>
          <th>ProductName</th>
          <th>ChemicalType</th>
          <th>ProductionDate</th>
          <th>Alert</th>
          <th>AlertTest1</th>
          <th>AlertTest2</th>
          <th>AlertTest3</th>
          <th>AlertTest4</th>
          <th>LocationKeep</th>
          <th>LocationWaste</th>
        </tr>
    `;

    todayItems.forEach(item => {
      htmlTable += `
        <tr>
          <td>${item.Uneg}</td>
          <td>${item.ProductName}</td>
          <td>${item.ChemicalType}</td>
          <td>${item.ProductionDate ?? ""}</td>
          <td>${item.Alert ?? ""}</td>
          <td>${item.AlertTest1 ?? ""}</td>
          <td>${item.AlertTest2 ?? ""}</td>
          <td>${item.AlertTest3 ?? ""}</td>
          <td>${item.AlertTest4 ?? ""}</td>
          <td>${item.LocationKeep ?? ""}</td>
          <td>${item.LocationWaste ?? ""}</td>
        </tr>
      `;
    });

    htmlTable += "</table>";

    // ส่งเมล
    const mailOptions = {
      from: "es1_auto@thaiparker.co.th",
      to: "teera@thaiparker.co.th",
      subject: "📩 รายงาน Alert ประจำวัน",
      html: htmlTable,
    };

    await transporter.sendMail(mailOptions);

    console.log("✅ ส่งเมลรายการ Alert วันนี้สำเร็จ");

  } catch (err) {
    console.error("❌ CRON ERROR:", err);
  }
});


// ==================== Start Server ====================
const PORT = 3006;
app.listen(PORT, () => console.log(`🚀 Server running on http://127.0.0.1:${PORT}`));
