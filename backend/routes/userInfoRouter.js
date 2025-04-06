// 使用者相關資料維護 -- 個人資料表、頭像
const express = require('express');
const router = express.Router();
const userModel = require('../models/userModel');
const groupModel = require('../models/groupModel')
const fs = require('fs');
const {format} = require('date-fns')
const { v4: uuidv4 } = require('uuid');
const multer = require('multer')
const path = require('path');


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

// 檢查是否超過空間用量
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
const checkUsageMemory = async(req,res,next)=>{
    try{
        const group = await groupModel.findOne({group: req.user.group})
        if (!group) {
            return res.send({
                type: 'error',
                message: '課程群組不存在。',
            });
        }
        const limitMemory = group.limit.memory;
        const databaseUrl = group.databaseUrl;
        const size = getFolderSize(databaseUrl) / (1024*1024);

        if (size >= limitMemory) {
            return res.send({
                type: 'error',
                message: `空間用量已超過限制 ${limitMemory} MB，如需調額請洽客服人員。`,
            });
        }
        next()
    }
    catch(e){
        console.error(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。',
        });
    }
}

// 更改頭貼 --> 由用戶自行修改，以 token 進行驗證
const upload = multer();
router.post('/api/userInfo/updateIcon', upload.fields([{ name: 'attachments', maxCount: 1}]), authMiddleware, checkUsageMemory, async (req, res) => {
    const token = req.headers['x-user-token']
    try {
        const groupInfo = await groupModel.findOne({group: req.user.group});
        if(!groupInfo){
            return res.send({
                type:'error',
                message:'頭貼上傳失敗（群組不存在）。'
            });
        }
        const databaseUrl = groupInfo.databaseUrl;
        try{

            let attachments = req.files['attachments'][0];
            
            if (!attachments) {
                return res.send({
                    type:'error',
                    message:'上傳頭像不可為空。'
                });
            }

            // 檢查資料夾是否存在
            const folderPath = `${databaseUrl}/userIcon/${req.user.idx}`;
            if (!fs.existsSync(folderPath)){
                fs.mkdirSync(folderPath, { recursive: true });
            }
            else { // 將資料夾清空並重建
                fs.rmSync(folderPath, { recursive: true });
                fs.mkdirSync(folderPath, { recursive: true });
            }

            const realPath = path.join(folderPath, attachments.originalname);
            fs.writeFileSync(realPath, attachments.buffer);


            const user = await userModel.findOneAndUpdate(
                { token: token },  // 查找條件
                { 
                    $set: { 
                        "userImgUrl.url": `/api/userInfo/getUserIcon/${req.user.idx}`, 
                        "userImgUrl.original": realPath 
                    } 
                },
                { new: true }  // 返回更新後的資料
            );
            if(!user){
                return res.send({
                    type:'success',
                    message:'頭像上傳失敗。'
                });
            }

            return res.send({
                type:'success',
                message:'頭像上傳成功。'
            });

        }
        catch(e){
            console.log(e)
            return res.send({
                type:'error',
                message:'頭像上傳失敗。'
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

// 返回頭貼
router.get('/api/userInfo/getUserIcon/:idx',async (req, res) => {

    const user = await userModel.findOne({idx: req.params.idx})
    
    const filePath = user.userImgUrl.original;

    if (fs.existsSync(filePath)) {
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } else {
        res.status(404).send('File not found');
    }
});


// 個人資料維護
router.get('/api/userInfo/getUserInfo/:idx',authMiddleware,async (req, res) => {
    const idx = req.params.idx;

    try{
        if(req.user.type  == 'teacher'){
            const user = await userModel.findOne({idx: idx, group: req.user.group})

            if(!user){
                return res.send({
                    type:'error',
                    message:'使用者資料獲取失敗'
                })
            }

            return res.send({
                type:'success',
                user:{
                    idx: user.idx,
                    type: user.type,
                    account: user.account,
                    password: user.password,
                    name: user.name,
                    phone: user.detail.phoneNumber,
                    address: user.detail.address,
                    mailAddress: user.detail.mailAddress,
                    userImgUrl: user.detail.photoStickers.url
                },
                message:'使用者資料獲取成功'
            })
        }
        else{
            return res.send({
                type: 'error',
                message: '您沒有權限查詢使用者資料。',
            });
        }
    }
    catch(e){
        console.log(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。',
        });
    }
});


router.post('/api/userInfo/modifyUserInfo/:idx',upload.fields([{ name: 'attachments', maxCount: 1}]), authMiddleware, checkUsageMemory,async (req, res) => {
    const idx = req.params.idx;
    const { password, name, phone, address, mailAddress} = JSON.parse(req.body.userInfo);

    try{
        if(req.user.type  == 'teacher'){

            const groupInfo = await groupModel.findOne({group: req.user.group});
            if(!groupInfo){
                return res.send({
                    type:'error',
                    message:'使用者資料更新失敗（群組不存在）。'
                });
            }
            const databaseUrl = groupInfo.databaseUrl;
            try{

                let attachments = req.files['attachments'] ? req.files['attachments'][0] : null;

                let userImgUrl = '';
                let realPath = '';

                if (attachments) {
                    // 檢查資料夾是否存在
                    const folderPath = `${databaseUrl}/userInfo/${idx}`;
                    if (!fs.existsSync(folderPath)){
                        fs.mkdirSync(folderPath, { recursive: true });
                    }
                    else { // 將資料夾清空並重建
                        fs.rmSync(folderPath, { recursive: true });
                        fs.mkdirSync(folderPath, { recursive: true });
                    }
        
                    realPath = path.join(folderPath, attachments.originalname);
                    userImgUrl = `/api/userInfo/getPhotoStickers/${idx}`
                    fs.writeFileSync(realPath, attachments.buffer);
                }
    
                const updateData = {
                    name: name,
                    password: password,
                    "detail.phoneNumber": phone,
                    "detail.address": address,
                    "detail.mailAddress": mailAddress
                };

                if (attachments) {
                    updateData["detail.photoStickers.url"] = userImgUrl;
                    updateData["detail.photoStickers.original"] = realPath;
                }

                const user = await userModel.findOneAndUpdate(
                    { idx: idx, group: req.user.group },
                    { $set: updateData },
                    { new: true }
                );

                if (!user) {
                    return res.send({
                        type: 'error',
                        message: '使用者資料更新失敗'
                    });
                }

                return res.send({
                    type: 'success',
                    message: '使用者資料更新成功'
                });
    
            }
            catch(e){
                console.log(e)
                return res.send({
                    type:'error',
                    message:'使用者資料更新失敗。'
                });
            }
            
        }
        else{
            return res.send({
                type: 'error',
                message: '您沒有權限更新使用者資料。',
            });
        }
    }
    catch(e){
        console.log(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。',
        });
    }
});

// 返回大頭照
router.get('/api/userInfo/getPhotoStickers/:idx',async (req, res) => {

    const user = await userModel.findOne({idx: req.params.idx})

    const filePath = user.detail.photoStickers.original;

    if (fs.existsSync(filePath)) {
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } else {
        res.status(404).send('File not found');
    }
});
module.exports = router;