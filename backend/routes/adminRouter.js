// admin 以及空間配置操作
const express = require('express');
const router = express.Router();

const fs = require('fs');
const path = require('path');
const {format} = require('date-fns')
const { v4: uuidv4 } = require('uuid');

const userModel = require('../models/userModel');
const groupModel = require('../models/groupModel');


// 檢查身份
const authMiddleware = async (req, res, next) => {
    const token = req.headers['x-user-token']
    if (!token) {
        return res.send({
            type: 'error',
            message: '未找到授權，請重新登入。',
        });
    }
    const user = await userModel.findOne({ token, status:true });
    if (!user) {
        return res.send({
            type: 'error',
            message: '未找到授權，請重新登入。',
        });
    }
    req.user = user;
    next();
};

// 下方為 admin 操作區

// 額外新增欄位
const update = async () => {
    try {
        const users = await userModel.find();

        for (let user of users) {
            await userModel.updateOne({ _id: user._id, type: 'teacher' }, { $set: { group: '0001' } });
        }

        console.log('所有文件的欄位已更新');
    } catch (error) {
        console.error('更新失敗:', error);
    }
};

// 新增教師
async function createTeacher(){
    const account = 'blc0000421';
    const password = '34864015';
    const type = 'teacher';
    const groupNum = '0001'
    const name = 'SCLemon'
    
    // 檢查群組是否已建立
    const group = await groupModel.findOne({group:groupNum});
    if(!group){
        return console.log('群組尚未建立。')
    }

    const newUser = new userModel({
        idx: uuidv4(),
        token:uuidv4(),
        account: account,
        password: password,
        name: name,
        group: groupNum,
        userImgUrl:{
            url:'https://megapx-assets.dcard.tw/images/f3d0ecad-6f94-44c3-a588-82cf94c4ad36/1280.jpeg',
        },
        createTime: format(new Date(),'yyyy-MM-dd HH:mm:ss'),
        type:type
    });

    await newUser.save();

    console.log('教師資料創建完畢')
}

// 新增群組資料庫
async function createDatabase(){
    const group = '0001'

    const databaseUrl = path.resolve(__dirname, `../../database/${group}`);
    if (!fs.existsSync(databaseUrl)) fs.mkdirSync(databaseUrl, { recursive: true });
    
    const newGroup = new groupModel({
        group:group,
        databaseUrl:databaseUrl,
        limit:{
            memory:1024,
            classNum:5,
            studentNum:10,
        }
    })

    await newGroup.save();
    console.log(`${group} 群組創建完畢`)
}

// createDatabase()
// createTeacher()

// 移動群組資料庫
async function moveDataBase(){

}

// 修改群組限制
async function modifyDatabaseLimit(){

}


// 以下為硬體裝置 API
// 獲取使用容量
function getFolderSize(folderPath) {
    let totalSize = 0;
    const files = fs.readdirSync(folderPath);
    files.forEach((file) => {
      const filePath = path.join(folderPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) totalSize += getFolderSize(filePath);
      else totalSize += stat.size;
    });
  
    return totalSize;
}

router.get('/api/getUsageMemory',authMiddleware, async (req, res) => {
   
    try {
        if (req.user.type === 'teacher') {
            const group = await groupModel.findOne({group:req.user.group});
            if (!group){
                return res.send({
                    type: 'error',
                    message: '群組資料不存在，請洽客服人員。',
                });
            }
            const databaseUrl = group.databaseUrl;
            if (!fs.existsSync(databaseUrl)){
                return res.send({
                    type: 'error',
                    message: '群組資料庫不存在，請洽客服人員。',
                });
            }
            const size = getFolderSize(databaseUrl) / (1024*1024);
            return res.send({
                type:'success',
                limit: group.limit,
                size:size,
                message:'儲存空間用量資訊獲取成功！'
            })
        } 
        else {
            return res.send({
                type: 'error',
                message: '您沒有權限查看儲存空間用量。',
            });
        }
    } catch (e) {
        console.log(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。',
        });
    }
});



module.exports = router;