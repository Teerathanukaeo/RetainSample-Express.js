const express = require("express");
const router = express.Router();
var mssql = require('../../function/mssql');
var mongodb = require('../../function/mongodb');
var httpreq = require('../../function/axios');
var axios = require('axios');


router.get('/TEST', async (req, res) => {
  // console.log(mssql.qurey())
  res.json("TEST");
})

router.post('/MKTKPI/test', async (req, res) => {
  //-------------------------------------
  console.log("--MKTKPI/test--");
  console.log(req.body);
  let input = req.body;
  //-------------------------------------
  let date = Date.now()


  //-------------------------------------
  return res.json(date);
});

router.post('/MKTKPI/getdata', async (req, res) => {
  //-------------------------------------
  console.log("--MKTKPI/getdata--");
  console.log(req.body);
  let input = req.body;
  //-------------------------------------
  let output = [];
  let query = `SELECT * FROM [SAR].[dbo].[Routine_MasterPatternTS] order by "CustId" desc`

  // console.log(query)
  let db = await mssql.qurey(query);
  if (db["recordsets"].length > 0) {
    let buffer = db["recordsets"][0];
    let uniqueData = Array.from(new Map(buffer.map(item => [item['CustShort'], item])).values());
    output = uniqueData;
  }

  //const


  //-------------------------------------
  return res.json(output);
});

router.post('/MKTKPI/UPDATETYPEGROUP', async (req, res) => {
  //-------------------------------------
  console.log("--MKTKPI/getdata--");
  console.log(req.body);
  let input = req.body;
  //-------------------------------------
  let output = 'NOK';
  if(input["TYPE"] !== undefined&&input["GROUP"] !== undefined&&input["Id"] !== undefined&&input["MKTGROUP"] !== undefined&&input["FRE"] !== undefined&&input["REPORTITEMS"] !== undefined){


 
  let query = `UPDATE  [SAR].[dbo].[Routine_MasterPatternTS] SET [TYPE] ='${input["TYPE"]}' , [GROUP] ='${input["GROUP"]}' , [MKTGROUP] ='${input["MKTGROUP"]}' , [FRE] ='${input["FRE"]}', [REPORTITEMS] ='${input["REPORTITEMS"]}' WHERE [Id]=${input["Id"]}`

  console.log(query)
  let db = await mssql.qurey(query);
  let output = 'OK';
  }
  // if(db["recordsets"].length >0 ){
  //   let buffer = db["recordsets"][0];
  //   let uniqueData = Array.from(new Map(buffer.map(item => [item['CustShort'], item])).values());
  //   output = uniqueData;
  // }

  //const


  //-------------------------------------
  return res.json(output);
});


router.post('/MKTKPI/HOLLIDAYCOUNT', async (req, res) => {
  //-------------------------------------
  console.log("--MKTKPI/HOLLIDAYCOUNT--");
  console.log(req.body);
  let input = req.body;
  //-------------------------------------
  //input['PDAY']
  let output = { "status": "NOK" };
  if (input['DD'] !== undefined && input['MM'] !== undefined && input['YYYY'] !== undefined && input['PDAY'] !== undefined) {
    let DD = input['DD']
    let MM = input['MM']
    let YYYY = input['YYYY']

    let dayfor = parseInt(input['PDAY']) + 1
    let date = new Date(`${MM}-${DD}-${YYYY}`);

    // console.log(date.getDate())
    // console.log(date.getMonth())
    // console.log(date.getFullYear())

    for (let i = 0; i < dayfor; i++) {

      let datain = [];

      try {
        do {
          let query = `SELECT * FROM [SAR].[dbo].[Master_Holiday] where HolidayDate = '${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}'`
          console.log(query)
          let db = await mssql.qurey(query);
          datain = db["recordsets"][0]
          console.log(datain)
          console.log(datain.length)
          date.setDate(date.getDate() + 1);
          console.log(date)
          output['nextday'] = date;
        }
        while (datain.length > 0);
      } catch (error) {

      }

    }

  }



  //-------------------------------------
  return res.json(output);
});


module.exports = router;
