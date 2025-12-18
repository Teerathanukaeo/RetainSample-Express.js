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

function isToday(dateValue) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  if (isNaN(d)) return false;
  const today = new Date().toISOString().split("T")[0];
  const dateStr = d.toISOString().split("T")[0];
  return dateStr === today;
}

// ฟังก์ชัน format วันที่เป็น dd/mm/yyyy
function formatDate(dateValue) {
  if (!dateValue) return "-";
  const d = new Date(dateValue);
  if (isNaN(d)) return "-";
  return d.toLocaleDateString("th-TH");
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
        const result = await sql.query`
            SELECT *
            FROM SOI8_RetainSample
            WHERE Status <> 'End' AND Status <> 'Reject'
            ORDER BY Id DESC
        `;

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
        const result = await sql.query`SELECT * FROM SOI8_RetainSample WHERE ExpireDate = ${Expire} and Status = 'Inprocess'`;
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
             [Test1],[AlertTest1],[Test2],[AlertTest2],[Test3],[AlertTest3],[Test4],[AlertTest4],[Remark],[Status])
            VALUES (
                ${p.Uneg},${p.ProductName},${p.ChemicalType},${p.ChemicalPhysic},${p.ProductionDate},
                ${p.Alert},${p.ExpireDate},${p.LocationKeep},${p.LocationWaste},${p.Pcs},${p.InputData},
                ${p.Test1},${p.AlertTest1},${p.Test2},${p.AlertTest2},${p.Test3},${p.AlertTest3},${p.Test4},${p.AlertTest4},${p.Remark},${p.Status}
            );
        `;
        res.status(201).json({ message: "✅ Data inserted successfully" });
    } catch (err) {
        console.error("❌ Insert error:", err);
        res.status(500).send(err);
    }
});

app.post('/Accept', async (req, res) => {
  try {
    const { Uneg, Status } = req.body;

    if (!Uneg || !Status) {
      return res.status(400).json({ message: "Missing fields" });
    }

    await sql.query`
      UPDATE [ScadaReport].[dbo].[SOI8_RetainSample]
      SET Status = ${Status}
      WHERE Uneg = ${Uneg}
    `;

    console.log(`✔ Updated Uneg: ${Uneg} → Status: ${Status}`);

    res.status(200).json({ message: "Status updated successfully" });

  } catch (err) {
    console.error("❌ /accept error:", err);
    res.status(500).json({ message: err.message });
  }
});


app.post('/discard', async (req, res) => {
  try {
    const { Uneg, Status } = req.body;
    if (!Uneg || !Status) return res.status(400).json({ message: "Missing fields" });

    await sql.query`
      UPDATE [ScadaReport].[dbo].[SOI8_RetainSample]
      SET Status = ${Status}
      WHERE Uneg = ${Uneg}
    `;
    res.status(200).json({ message: "Status updated successfully" });
  } catch (err) {
    console.error("❌ /discard error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ==================== Print API ====================
app.post('/print', async (req, res) => {
  try {
    const p = req.body;
    if (!p.Uneg) return res.status(400).json({ message: "Missing Uneg" });

    // 🔹 เช็คจำนวน Pcs (ถ้าไม่มีหรือเป็น 0 ให้พิมพ์ 1 ครั้ง)
    const printCount = parseInt(p.Pcs) || 1;
    console.log(`🖨️  จำนวนที่ต้องพิมพ์: ${printCount} ใบ`);

    // 🔹 ZPL สำหรับพิมพ์หลายใบ + Serial Number
    const zplWithQuantity = `
^XA
^PW1116
^LL780
^CF0,45
^PQ2,0,1,Y
^FX ==========================
^FX Setup Serial Number
^FX ==========================
^SN1,1,Y
^FX ==========================
^FX Draw Frames
^FX ==========================
^FO15,15^GB1086,750,5^FS
^FO15,15^GB635,220,5^FS
^FO645,15^GB455,150,5^FS
^FO645,160^GB455,160,5^FS
^FO15,540^GB635,130,5^FS
^FO332,540^GB5,130,5^FS
^FO15,665^GB635,100,5^FS
^FO332,665^GB5,100,5^FS
^FO645,314^GB455,450,5^FS
^FX ==========================
^FX Field Titles
^FX ==========================
^CF0,30
^FO25,30^FDProduct Name^FS
^FO655,30^FDChemical Type^FS
^FO655,175^FDInput by^FS
^FO25,555^FDLocation Keep^FS
^FO340,555^FDLocation Waste^FS
^FO25,680^FDProduction Date^FS
^FO340,680^FDExpire Date^FS
^FX ==========================
^FX TAG (Top Right)
^FX ==========================
^CF0,30
^FO960,30^FDTag ^FS
^FO1030,30^SN^FS
^FO1060,30^FD/2^FS
^FX ==========================
^FX QR Code
^FX ==========================
^FO710,330
^BQN,2,16
^FDLA,UNEG1765266759608^FS
^CF0,35
^FO730,700^FDUNEG1765266759608^FS
^FX ==========================
^FX Item Data
^FX ==========================
^CF0,35
^FO70,725^FD2025-12-09^FS
^FO390,725^FD2026-06-07^FS
^FO70,620^FDRetain Room^FS
^FO370,590
^FB250,2,0,L,0
^FDIBC for Used Oil^FS
^CF0,60
^FO40,100^FDFR-169TFt^FS
^FO710,100^FDNox Rust^FS
^FO710,255^FDmantana^FS
^FX ==========================
^FX Test Period
^FX ==========================
^CF0,35
^FO150,300^FDTest 90 Day : -^FS
^FO150,350^FDTest 180 Day: -^FS
^FO150,400^FDTest 270 Day: -^FS
^FO150,450^FDTest 365 Day: -^FS
^FO40,180^FDBatch 3^FS
^XZ
`;

    console.log("📤 ZPL string ที่จะส่งไปเครื่องพิมพ์:\n", zplWithQuantity);

    const PRINTER_IP = "172.26.20.3";
    const PRINTER_PORT = 9100;
    const client = new net.Socket();

    client.connect(PRINTER_PORT, PRINTER_IP, () => {
      client.write(zplWithQuantity);
      client.end();
      console.log(`✅ ส่ง ZPL ไปเครื่องพิมพ์สำเร็จ: ${p.Uneg} (${printCount} ใบ)`);
      res.status(200).json({
        success: true,
        message: "Printed successfully",
        Uneg: p.Uneg,
        printCount: printCount
      });
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

cron.schedule("40 10 * * *", async () => {
  try {
    console.log("🚀 เริ่มทำงาน CRON 09:00 น.");

    // ==========================
    // Query SQL
    // ==========================
    const result = await sql.query(`
      SELECT [Uneg],[ProductName],[ChemicalType],[ChemicalPhysic],
             [ProductionDate],[Alert],[ExpireDate],[LocationKeep],
             [LocationWaste],[Pcs],[InputData],
             [Test1],[AlertTest1],[Test2],[AlertTest2],
             [Test3],[AlertTest3],[Test4],[AlertTest4],
             [Remark],[Status]
      FROM [ScadaReport].[dbo].[SOI8_RetainSample]
    `);

    const data = result.recordset;

    // ==========================
    // ฟังก์ชันเช็กวันนี้
    // ==========================
    function isToday(date) {
      if (!date) return false;
      const d = new Date(date);
      const t = new Date();
      d.setHours(0,0,0,0);
      t.setHours(0,0,0,0);
      return d.getTime() === t.getTime();
    }

    // ==========================
    // ฟังก์ชันเช็กค้างกำจัด
    // ==========================
    function isOverdue(date) {
      if (!date) return false;
      const d = new Date(date);
      const t = new Date();
      d.setHours(0,0,0,0);
      t.setHours(0,0,0,0);
      return d.getTime() < t.getTime();
    }

    // ==========================
    // 1) รายการทิ้ง (วันนี้ + ค้างกำจัด)
    // ==========================
    const discardList = data.filter(item =>
      item.Alert &&
      item.Status !== "END" &&
      (isToday(item.Alert) || isOverdue(item.Alert))
    );

    // ==========================
    // 2) รายการทดสอบ (เหมือนเดิม)
    // ==========================
    const testList = data.filter(item =>
      isToday(item.AlertTest1) ||
      isToday(item.AlertTest2) ||
      isToday(item.AlertTest3) ||
      isToday(item.AlertTest4)
    );

    console.log("📌 รายการทิ้ง (รวมค้าง):", discardList.length);
    console.log("🧪 รายการทดสอบวันนี้:", testList.length);

    // ==========================
    // ไม่มีอะไรเลย → ไม่ส่งเมล
    // ==========================
    if (discardList.length === 0 && testList.length === 0) {
      console.log("⭕ วันนี้ไม่มี Alert / Overdue / Test");
      return;
    }

    // ==========================
    // ตารางรายการทิ้ง
    // ==========================
    function createDiscardTable(rows) {
      if (rows.length === 0)
        return `<h3>📌 รายการที่ใกล้ถึงกำหนดทิ้ง</h3><p>— ไม่มีรายการ —</p>`;

      let html = `
        <h3>📌 รายการที่ใกล้ถึงกำหนดทิ้ง / ค้างกำจัด</h3>
        <table border="1" cellspacing="0" cellpadding="6"
          style="border-collapse: collapse; font-family: Arial;">
          <tr style="background:#C00000; color:white;">
            <th>Uneg</th>
            <th>ProductName</th>
            <th>ChemicalType</th>
            <th>วันผลิต</th>
            <th>วันหมดอายุ</th>
            <th>สถานที่จัดเก็บ</th>
            <th>สถานที่ทิ้ง</th>
            <th>สถานะ</th>
          </tr>
      `;

      rows.forEach(item => {
        const overdue = isOverdue(item.Alert);
        html += `
          <tr>
            <td>${item.Uneg ?? "-"}</td>
            <td>${item.ProductName ?? "-"}</td>
            <td>${item.ChemicalType ?? "-"}</td>
            <td>${formatDate(item.ProductionDate)}</td>
            <td>${formatDate(item.ExpireDate)}</td>
            <td>${item.LocationKeep ?? "-"}</td>
            <td>${item.LocationWaste ?? "-"}</td>
            <td style="color:${overdue ? "red" : "black"}; font-weight:bold;">
              ${overdue ? "⚠️ ค้างกำจัด" : "วันนี้ต้องทิ้ง"}
            </td>
          </tr>
        `;
      });

      html += "</table>";
      return html;
    }

    // ==========================
    // ตารางรายการทดสอบ
    // ==========================
    function createTestTable(rows) {
      if (rows.length === 0)
        return `<h3>🧪 รายการที่ใกล้ถึงกำหนดทดสอบ</h3><p>— ไม่มีรายการวันนี้ —</p>`;

      let html = `
        <h3>🧪 รายการที่ใกล้ถึงกำหนดทดสอบ</h3>
        <table border="1" cellspacing="0" cellpadding="6"
          style="border-collapse: collapse; font-family: Arial;">
          <tr style="background:#0078D7; color:white;">
            <th>Uneg</th>
            <th>ProductName</th>
            <th>ChemicalType</th>
            <th>วันผลิต</th>
            <th>วันหมดอายุ</th>
            <th>ทดสอบ 1</th>
            <th>ทดสอบ 2</th>
            <th>ทดสอบ 3</th>
            <th>ทดสอบ 4</th>
          </tr>
      `;

      rows.forEach(item => {
        html += `
          <tr>
            <td>${item.Uneg ?? "-"}</td>
            <td>${item.ProductName ?? "-"}</td>
            <td>${item.ChemicalType ?? "-"}</td>
            <td>${formatDate(item.ProductionDate)}</td>
            <td>${formatDate(item.ExpireDate)}</td>
            <td>${formatDate(item.Test1)}</td>
            <td>${formatDate(item.Test2)}</td>
            <td>${formatDate(item.Test3)}</td>
            <td>${formatDate(item.Test4)}</td>
          </tr>
        `;
      });

      html += "</table>";
      return html;
    }

    // ==========================
    // HTML Email
    // ==========================
    const emailHtml = `
      <div style="font-family: Arial; padding: 10px;">
        ${createDiscardTable(discardList)}
        <br><hr><br>
        ${createTestTable(testList)}
      </div>
    `;

    // ==========================
    // ส่งเมล
    // ==========================
    await transporter.sendMail({
      from: "es1_auto@thaiparker.co.th",
      to: [
        "Krongkarn@thaiparker.co.th",
        "Mantana@thaiparker.co.th",
        "Teera@thaiparker.co.th"
      ],
      subject: "📩 รายงาน Alert ประจำวัน (กำหนดทิ้ง / ค้างกำจัด / ทดสอบ)",
      html: emailHtml
    });

    console.log("✅ ส่งเมลสำเร็จ");

  } catch (err) {
    console.error("❌ CRON ERROR:", err);
  }
});




// ==================== Start Server ====================
const PORT = 3006;
app.listen(PORT, () => console.log(`🚀 Server running on http://127.0.0.1:${PORT}`));
