const express = require("express");
const router = express.Router();
var mssql = require('../../function/mssql');
var mssqlR = require('../../function/mssqlR');
var mongodb = require('../../function/mongodb');
var httpreq = require('../../function/axios');
var axios = require('axios');
const e = require("express");
const schedule = require("node-schedule");

// mssql.connect(dbConfig, (err) => {
//     if (err) {
//         console.error('Database connection failed: ', err);
//     } else {
//         console.log('Connected to the database');
//     }
// });

// API สำหรับการ login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // ใช้ parameterized query เพื่อป้องกัน mssql Injection
        const result = await mssql.qurey(query)`
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
        console.error('Error executing mssql query:', err);
        res.status(500).send('Internal Server Error');
    }
});

// API สำหรับดึงข้อมูลจาก E_StockMat
router.get('/Mat', async (req, res) => {
    
    try {
        console.log("✅ POST /Mat called");
        const result = await mssql.qurey(query)`SELECT * FROM [E_Stock].[dbo].[E_StockMat]`;
        if (result.recordset.length > 0) {
            res.json(result.recordset);
        } else {
            res.status(404).json({ message: 'No data found' });
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

router.get('/Log', async (req, res) => {
    try {
        const result = await mssql.qurey(query)`SELECT * FROM E_StockLog order by Date desc`;
        if (result.recordset.length > 0) {
            res.json(result.recordset);
        } else {
            res.status(404).json({ message: 'No data found' });
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// API สำหรับการอัปเดตปริมาณใน E_StockMat123
router.put('/Mat/:Mat', async (req, res) => {
    const mat = req.params.Mat;
    const { Quantity } = req.body;

    try {
        // ทำการอัปเดตปริมาณของ Mat ที่มี mat ที่ระบุ
        const result = await mssql.qurey(query)`UPDATE E_StockMat SET Quantity = ${Quantity} WHERE Mat = ${mat}`;
        
        if (result.rowsAffected > 0) {
            res.json({ success: true, message: 'Quantity updated successfully' });
        } else {
            res.status(404).json({ success: false, message: `Mat with ID ${mat} not found` });
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// API สำหรับบันทึกข้อมูลการนำเข้าใน E_StockLog
router.post('/E_StockTemp', async (req, res) => {
    console.log("✅ POST /E_StockTemp called");
    const { Date, Mat, Name, Volume, Customer, Remark} = req.body;
    console.log("E_StockTemp:", req.body);
    const Type = 'Import'; // กำหนดค่า Type เป็น 'Import'

    try {
        // ใช้ parameterized query เพื่อป้องกัน mssql Injection
        const result = await mssql.qurey(query)`
            INSERT INTO E_StockTemp (Date, Mat, Name, Volume, Customer, Remark)
            VALUES (${Date}, ${Mat}, ${Name}, ${Volume}, ${Customer}, ${Remark})
        `;

        res.json({ success: true, message: 'Log inserted successfully' });
    } catch (err) {
        // หากเกิดข้อผิดพลาดในการสอบถามฐานข้อมูล
        console.error('Error executing mssql query:', err);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/E_StockLogExport', async (req, res) => {
    const { Mat, Quantity, Remark, Date, UserName, Name} = req.body;
    const Type = 'Export'; // กำหนดค่า Type เป็น 'Import'

    try {
        // ใช้ parameterized query เพื่อป้องกัน mssql Injection
        const result = await mssql.qurey(query)`
            INSERT INTO E_StockLog (Mat, Quantity, Remark, Date, Type, UserName, Name)
            VALUES (${Mat}, ${Quantity}, ${Remark}, ${Date}, ${Type}, ${UserName}, ${Name})
        `;

        res.json({ success: true, message: 'Log inserted successfully' });
    } catch (err) {
        // หากเกิดข้อผิดพลาดในการสอบถามฐานข้อมูล
        console.error('Error executing mssql query:', err);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;