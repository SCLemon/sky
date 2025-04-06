// 針對創建學生
const express = require('express');
const router = express.Router();
const userModel = require('../models/userModel');
const groupModel = require('../models/groupModel')
const {format} = require('date-fns')
const { v4: uuidv4 } = require('uuid');
const fs = require('fs')

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

// 檢查用戶數
const checkStudentNum = async(req,res,next)=>{
    try{
        const group = await groupModel.findOne({group: req.user.group})

        if (!group) {
            return res.send({
                type: 'error',
                message: '課程群組不存在。',
            });
        }
        const limitNum = group.limit.studentNum;

        let students = await userModel.find({ type: 'student', group: req.user.group });

        if (students.length >= limitNum) {
            return res.send({
                type: 'error',
                message: `創建人數已達限制 ${limitNum} 人，如需調額請洽客服人員。`,
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


// 創建新用戶
router.post('/api/infoPage/createStudent',authMiddleware,checkStudentNum, async (req, res) => {
    const {account, password, name, type} = req.body;

    try {
        if (req.user.type === 'teacher') {
            const newUser = new userModel({
                idx: uuidv4(),
                token:uuidv4(),
                account: account,
                password: password,
                name: name,
                group: req.user.group,
                createTime: format(new Date(),'yyyy-MM-dd HH:mm:ss'),
                type:type
            });
        
            try{
                await newUser.save()
                return res.send({
                    type:'success',
                    message:'用戶創建成功。'
                });
            }
            catch(e){
                console.log(e)
                return res.send({
                    type:'error',
                    message:'用戶創建失敗。'
                });
            }
        } 
        else {
            return res.send({
                type: 'error',
                message: '您沒有權限創建學生資料。',
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

// 刪除用戶
async function deleteFolderOfUser(idx,req){
    const group = await groupModel.findOne({group:req.user.group})

    if(!group){
        return res.send({
            type:'error',
            message: '用戶刪除失敗！',
        })
    }
    const databaseUrl = group.databaseUrl;
    const folders = ['userIcon','userInfo']
    try{
        folders.forEach(folder =>{
            const path = `${databaseUrl}/${folder}/${idx}`
            if(fs.existsSync(path)) fs.rmSync(path,{recursive:true})
        })
    }
    catch(e){}
}
router.delete('/api/infoPage/deleteStudent/:idx',authMiddleware,async(req,res)=>{
    try {
        if (req.user.type === 'teacher') {

            const idx = req.params.idx;
            
            if (!idx || typeof idx !== 'string' || idx.length !== 36) {
                return res.send({
                    type: 'error',
                    message: '用戶刪除失敗！'
                });
            }

            await deleteFolderOfUser(idx,req)

            const deletedUser = await userModel.findOneAndDelete({ idx: idx });

            if (!deletedUser) {
                return res.send({
                    type: 'error',
                    message: '用戶刪除失敗！',
                });
            }

            return res.send({
                type: 'success',
                message: `學生 ${deletedUser.account} 已成功刪除。`,
            });
        } 
        else {
            return res.send({
                type: 'error',
                message: '您沒有權限創建學生資料。',
            });
        }
    } catch (e) {
        console.log(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。',
        });
    }
})

// 凍結用戶
router.put('/api/infoPage/stopStudent/:idx',authMiddleware,async(req,res)=>{
    try {
        if (req.user.type === 'teacher') {

            const idx = req.params.idx;
            
            if (!idx || typeof idx !== 'string' || idx.length !== 36) {
                return res.send({
                    type: 'error',
                    message: '用戶權限變更失敗！'
                });
            }
            const user = await userModel.findOne({ idx: idx, group:req.user.group });

            if (!user) {
                return res.send({
                    type: 'error',
                    message: '用戶權限變更失敗！',
                });
            }

            const updatedUser = await userModel.findOneAndUpdate({ idx: idx , group:req.user.group},{ $set: { status: !user.status } },{ new: true });

            if (!updatedUser) {
                return res.send({
                    type: 'error',
                    message: '用戶權限變更失敗！',
                });
            }

            return res.send({
                type: 'success',
                message: `學生 ${updatedUser.account} 權限變更成功。`,
            });
        } 
        else {
            return res.send({
                type: 'error',
                message: '您沒有權限修改學生資料。',
            });
        }
    } catch (e) {
        console.log(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。',
        });
    }
})


// 獲取學生資料
router.get('/api/infoPage/getStudent',authMiddleware, async (req, res) => {

    try {

        if (req.user.type === 'teacher') {

            let students = await userModel.find({ type: 'student', group: req.user.group });

            students = students.map(obj=>{
                return {
                    idx:obj.idx,
                    createTime:obj.createTime,
                    account:obj.account,
                    lastOnline:obj.lastOnline,
                    loginIP:obj.loginIP,
                    name:obj.name,
                    status:obj.status
                }
            })

            return res.send({
                type: 'success',
                students:students,
                message: '資料查詢成功。',
            });
        } 
        else {
            return res.send({
                type: 'error',
                message: '您沒有權限查看學生資料。',
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