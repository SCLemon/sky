const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    group:{
        type: String,
        required:true,
        trim: true,
        unique: true,
    },
    limit:{
        type:{
            memory:Number, // 單位 MB
            classNum:Number,
            studentNum:Number
        },
        default:{ // 免費用戶
            memory: 512,
            classNum:1,
            studentNum:1,
        }
    },
    databaseUrl:{ // 資料儲存位置
        type: String,
        required:true,
        trim: true,
        unique: true,
    },
    status: {
        type: Boolean,
        default: true,
    },
});

const groupModel = mongoose.model('Group', groupSchema);

module.exports = groupModel;
