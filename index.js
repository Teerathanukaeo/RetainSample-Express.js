// ==================== Import Packages ====================
const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const cors = require('cors');
const nodemailer = require('nodemailer');
const cron = require("node-cron");
const net = require('net');

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

app.post('/print_Special', async (req, res) => {
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
^FB300,2,0,L,0
^FD${p.LocationWaste || '-'}^FS

^CF0,60 
^FO40,100^FD${p.ProductName || '-'}^FS
^FO710,100^FD${p.ChemicalType|| '-'}^FS
^FO710,255^FD${p.InputData|| '-'}^FS       

// ==========================
// เพิ่ม Test 90/180/270/365 Day
// ==========================
^CF0,35
^FO230,350^FDTest 90 Day: ${p.Test1 || '-'}^FS
^FO230,400^FDTest 180 Day: ${p.Test2 || '-'}^FS
^FO230,450^FDTest 270 Day: ${p.Test3 || '-'}^FS
^FO230,500^FDTest 365 Day: ${p.Test4 || '-'}^FS

^XZ

`;


    // 🔹 พิมพ์ ZPL string ลง console ก่อนส่ง
    console.log("📤 ZPL string ที่จะส่งไปเครื่องพิมพ์:\n", zpl);

    const PRINTER_IP = "172.26.20.4";
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
    console.log("⏳ กำลังตรวจสอบรายการ Alert + Test...");

    const pool = await sql.connect(dbConfig);
    const today = new Date().toISOString().substring(0, 10);

    const result = await pool.query(`
      SELECT
        Id, Uneg, ProductName, ChemicalType, ProductionDate, ExpireDate,
        LocationKeep, LocationWaste, InputData,
        Alert, AlertTest1, AlertTest2, AlertTest3, AlertTest4
      FROM SOI8_RetainSample
      WHERE 
        CONVERT(date, Alert) = '${today}' OR
        CONVERT(date, AlertTest1) = '${today}' OR
        CONVERT(date, AlertTest2) = '${today}' OR
        CONVERT(date, AlertTest3) = '${today}' OR
        CONVERT(date, AlertTest4) = '${today}'
    `);

    const items = result.recordset;

    if (items.length === 0) {
      console.log("ℹ️ วันนี้ไม่มีรายการครบกำหนด");
      return;
    }

    // กลุ่มรายการตามประเภท Alert
    const groups = {
      Alert: [],
      AlertTest1: [],
      AlertTest2: [],
      AlertTest3: [],
      AlertTest4: []
    };

    items.forEach(item => {
      if (item.Alert && item.Alert.toISOString().substring(0, 10) === today)
        groups.Alert.push(item);

      if (item.AlertTest1 && item.AlertTest1.toISOString().substring(0, 10) === today)
        groups.AlertTest1.push(item);

      if (item.AlertTest2 && item.AlertTest2.toISOString().substring(0, 10) === today)
        groups.AlertTest2.push(item);

      if (item.AlertTest3 && item.AlertTest3.toISOString().substring(0, 10) === today)
        groups.AlertTest3.push(item);

      if (item.AlertTest4 && item.AlertTest4.toISOString().substring(0, 10) === today)
        groups.AlertTest4.push(item);
    });

    function buildTable(title, rows) {
      if (rows.length === 0) return "";

      const rowsHtml = rows.map(item => `
        <tr>
          <td>${item.Uneg}</td>
          <td>${item.ProductName}</td>
          <td>${item.ChemicalType}</td>
          <td>${item.ProductionDate ? new Date(item.ProductionDate).toLocaleDateString('th-TH') : "-"}</td>
          <td>${item.ExpireDate ? new Date(item.ExpireDate).toLocaleDateString('th-TH') : "-"}</td>
          <td>${item.LocationKeep || "-"}</td>
          <td>${item.LocationWaste || "-"}</td>
          <td>${item.InputData || "-"}</td>
        </tr>
      `).join("");

      return `
        <h3 style="color:#0078D7;">${title} (${rows.length} รายการ)</h3>
        <table border="1" cellspacing="0" cellpadding="6" 
          style="border-collapse: collapse; width:100%; font-size:14px;">
          <tr style="background:#0078D7; color:white;">
            <th>Uneg</th>
            <th>ProductName</th>
            <th>ChemicalType</th>
            <th>ProductionDate</th>
            <th>ExpireDate</th>
            <th>LocationKeep</th>
            <th>LocationWaste</th>
            <th>InputData</th>
          </tr>
          ${rowsHtml}
        </table>
        <br/>
      `;
    }

    // สร้าง HTML เมล
    let htmlContent = `
      <h2>📌 รายงาน Retain Sample ครบกำหนดวันนี้ (${new Date().toLocaleDateString('th-TH')})</h2>
    `;

    htmlContent += buildTable("🔔 Alert (วันครบกำหนด Retain)", groups.Alert);
    htmlContent += buildTable("🧪 Test 90 Day", groups.AlertTest1);
    htmlContent += buildTable("🧪 Test 180 Day", groups.AlertTest2);
    htmlContent += buildTable("🧪 Test 270 Day", groups.AlertTest3);
    htmlContent += buildTable("🧪 Test 365 Day", groups.AlertTest4);

    const mailOptions = {
      from: "es1_auto@thaiparker.co.th",
      to: "teera@thaiparker.co.th",
      subject: "📩 รายงาน Retain Sample ครบกำหนดวันนี้",
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ ส่งเมลสรุปรายการสำเร็จ");

  } catch (err) {
    console.error("❌ CRON ERROR:", err);
  }
});


// ==================== Start Server ====================
const PORT = 3006;
app.listen(PORT, () => console.log(`🚀 Server running on http://127.0.0.1:${PORT}`));
