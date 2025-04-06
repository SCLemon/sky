// 針對 Learn 課程列表
const express = require('express');
const router = express.Router();
const userModel = require('../models/userModel');
const courseModel = require('../models/courseModel');
const groupModel = require('../models/groupModel');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const multer = require('multer')
const { v4: uuidv4 } = require('uuid');

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


router.get('/api/learn/getCourse', authMiddleware, async (req, res) => {
    try {
        let courses = [];

        if (req.user.type === 'teacher') {
            courses = await courseModel.find({ group: req.user.group});
        } 
        else if (req.user.type === 'student') {
            courses = await courseModel.find({
                group: req.user.group,
                studentList: req.user.idx,
                status: true,
            });
        }
        else {
            return res.send({
                type: 'error',
                message: '課程資料查詢失敗。',
            })
        }

        if (courses.length === 0) {
            return res.send({
                type: 'success',
                courses: [],
                message: '課程資料查詢成功。',
            });
        }

        courses = await Promise.all(
            courses.map(async (course) => {
                let bannerImg = [];
                
                const folderPath = course.folderPath;
                const bannerFolderPath = `${folderPath}/banner`

                if (fs.existsSync(bannerFolderPath)) {
                    bannerImg = fs.readdirSync(bannerFolderPath).map((file) => {
                        return {
                            name: file,
                            url: `/api/learn/getCourseBanner/${course.idx}/${file}`, // 使用相對URL返回圖片
                        };
                    });
                }
                // 若無 banner
                if(bannerImg.length == 0) bannerImg.push({name:'default_course_banner',url:'img/default_course_banner.jpg'})
                return {
                    idx: course.idx,
                    createTime: course.createTime,
                    courseId: course.courseId,
                    courseName: course.courseName,
                    lecturer: course.lecturer,
                    status: course.status,
                    bannerImg: bannerImg,
                };
            })
        );

        return res.send({
            type: 'success',
            courses: courses,
            message: '課程資料查詢成功。',
        });
    } catch (e) {
        console.log(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。',
        });
    }
});

// 返回圖片
router.get('/api/learn/getCourseBanner/:idx/:imageName',async (req, res) => {
    const { idx, imageName } = req.params;
    
    const course = await courseModel.findOne({ idx: idx });
    const folderPath = course.folderPath;
    const filePath = path.join(folderPath, 'banner', imageName);

    if (fs.existsSync(filePath)) {

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } else {
        res.status(404).send('File not found');
    }
});


// 教材建立
const upload = multer();
router.post('/api/learn/createMaterial',upload.fields([{ name: 'attachments'}]),authMiddleware,checkUsageMemory, async (req, res) => {
    
    const {idx, title, abstract, videoSrc} = req.body;

    const courses = await courseModel.findOne({idx:idx, group:req.user.group});

    if(!courses){
        return res.send({
            type:'error',
            message:'教材上傳失敗（課程不存在）。'
        });
    }

    const databaseUrl = courses.folderPath;
    
    try {
        if (req.user.type === 'teacher') {
            
            // 創建教材專屬 idx
            const materialIdx = uuidv4();
            
            try{
                // 創建教材專屬資料夾
                const folderPath = `${databaseUrl}/${materialIdx}`

                if (fs.existsSync(folderPath)){
                    fs.rmSync(folderPath,{recursive:true})
                    fs.mkdirSync(folderPath, { recursive: true });
                }
                else fs.mkdirSync(folderPath, { recursive: true });

                let attachments = req.files['attachments']?req.files['attachments']:[]

                attachments.forEach((file) => {
                    const filePath = `${folderPath}/${file.originalname}`
                    fs.writeFileSync(filePath, file.buffer);
                });

                const url = `/api/learn/getMaterial/${idx}/${materialIdx}`

                courses.meta.push({
                    idx: materialIdx,
                    title:title,
                    abstract:abstract,
                    videoSrc:videoSrc,
                    attachmentUrl:{
                        name:title,
                        url:url,
                        original: folderPath
                    }
                });

                await courses.save();

                return res.send({
                    type:'success',
                    message:'課程教材上傳成功。'
                });

            }
            catch(e){
                console.log(e)
                return res.send({
                    type:'error',
                    message:'課程教材上傳失敗。'
                });
            }
        } 
        else {
            return res.send({
                type: 'error',
                message: '您沒有權限創建課程資料。',
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

// 教材更新
router.post('/api/learn/modifyMaterial',upload.fields([{ name: 'attachments'}]),authMiddleware,checkUsageMemory, async (req, res) => {
    
    const {idx, materialIdx, title, abstract, videoSrc} = req.body;

    const result = await courseModel.updateOne(
        { idx: idx, group: req.user.group, 'meta.idx': materialIdx }, // 查找符合條件的課程
        {
            $set: {
                'meta.$.title': title,
                'meta.$.abstract': abstract,
                'meta.$.videoSrc': videoSrc
            }
        }
    ,{ returnDocument: 'after' } );

    if(!result){
        return res.send({
            type:'error',
            message:'教材更新失敗（教材不存在）。'
        });
    }
    
    try {
        if (req.user.type === 'teacher') {
            
            try{

                const updatedCourse = await courseModel.findOne({ idx: idx, group: req.user.group });
                const updatedMaterial = updatedCourse.meta.find(item => item.idx === materialIdx);
            
                const folderPath = updatedMaterial.attachmentUrl.original

                if (fs.existsSync(folderPath)){
                    fs.rmSync(folderPath,{recursive:true})
                    fs.mkdirSync(folderPath, { recursive: true });
                }
                else fs.mkdirSync(folderPath, { recursive: true });

                let attachments = req.files['attachments']?req.files['attachments']:[]

                attachments.forEach((file) => {
                    const filePath = `${folderPath}/${file.originalname}`
                    fs.writeFileSync(filePath, file.buffer);
                });

                return res.send({
                    type:'success',
                    message:'課程教材更新成功。'
                });

            }
            catch(e){
                console.log(e)
                return res.send({
                    type:'error',
                    message:'課程教材更新失敗。'
                });
            }
        } 
        else {
            return res.send({
                type: 'error',
                message: '您沒有權限更新課程資料。',
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

// 刪除教材
router.get('/api/learn/deleteMaterial/:idx/:materialIdx', authMiddleware, async (req, res) => {
    const { idx, materialIdx } = req.params;

    const courses = await courseModel.findOne({ idx: idx, group: req.user.group });

    if (!courses) {
        return res.send({
            type: 'error',
            message: '找不到課程資料。',
        });
    }

    const material = courses.meta.find(item => item.idx === materialIdx);

    if (!material) {
        return res.send({
            type: 'error',
            message: '教材未找到。',
        });
    }

    try {
        if (req.user.type === 'teacher') {
            try {
                const folderPath = material.attachmentUrl.original;

                if (fs.existsSync(folderPath)) {
                    fs.rmSync(folderPath, { recursive: true });
                }

                const result = await courseModel.findOneAndUpdate(
                    { idx: idx, group: req.user.group, 'meta.idx': materialIdx },
                    {
                        $pull: {
                            meta: { idx: materialIdx }
                        }
                    },
                    { new: true }
                );

                if (!result) {
                    return res.send({
                        type: 'error',
                        message: '教材刪除失敗（教材不存在）。'
                    });
                }

                return res.send({
                    type: 'success',
                    message: '課程教材刪除成功。'
                });

            } catch (e) {
                console.log(e);
                return res.send({
                    type: 'error',
                    message: '課程教材刪除失敗。',
                });
            }
        } else {
            return res.send({
                type: 'error',
                message: '您沒有權限刪除課程資料。',
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


// 特定教材下載
router.get('/api/learn/getMaterial/:idx/:materialIdx',async (req,res)=>{
    const { idx, materialIdx } = req.params;

    try {
        const course = await courseModel.findOne({ idx: idx });

        if (!course || !course.meta) {
            return res.send({ type: 'error', message: '找不到課程資料。' });
        }

        const material = course.meta.find(m => m.idx === materialIdx);
        if (!material) {
            return res.send({ type: 'error', message: '找不到指定教材。' });
        }

        const folderPath = material.attachmentUrl.original;

        if (!fs.existsSync(folderPath)) {
            return res.send({ type: 'error', message: '教材資料夾不存在。' });
        }

        res.setHeader('Content-Type', 'application/zip');

        const fileName = material.title; 
        const encodedFileName = encodeURIComponent(fileName);

        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}.zip`);
   

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        archive.directory(folderPath, false);

        archive.finalize();
    } catch (e) {
        console.error(e);
        return res.send({ type: 'error', message: '伺服器錯誤，請稍後再試。' });
    }
})

// 獲取教材列表
router.get('/api/learn/getCourserMaterial/:idx', authMiddleware, async (req, res) => {
    try {
        const idx = req.params.idx;

        const course = await courseModel.findOne({ idx:idx, group: req.user.group});
        
        if (!course) {
            return res.send({
                type: 'success',
                message: '課程教材查詢失敗。',
            });
        }

        const simplifiedMaterial = course.meta.map(material => {
            return {
                ...material._doc,
                attachmentUrl:material.attachmentUrl.url
            };
        });

        return res.send({
            type: 'success',
            material: simplifiedMaterial,
            message: '課程教材查詢成功。',
        });
    } catch (e) {
        console.log(e);
        return res.send({
            type: 'error',
            message: '伺服器錯誤，請洽客服人員協助。',
        });
    }
});
module.exports = router;