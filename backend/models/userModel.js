const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    createTime:String,
    // 可傳到前端系統判定
    idx:{
        type: String,
        required:true,
        unique: true,
        trim: true,
    },
    // 姓名
    name:{
        type: String,
        required:true,
        trim: true,
    },
    // 頭像 -- 顯現在前端用
    userImgUrl: {
        url: { 
            type: String, 
            trim: true, 
            default: 'img/user.png' 
        },
        original: { 
            type: String, 
            trim: true, 
            default: '' 
        }
    },
    // 不可傳到前端系統判定
    token: {
        type: String,
        required:true,
        unique: true,
        trim: true,
    },
    group:{
        type: String,
        required:true,
        trim: true,
    },
    account:{
        type:String,
        required:true,
        unique: true,
        trim: true,
    },
    password:{
        type:String,
        required:true,
        trim: true,
    },
    type:{
        type:String,
        required:true,
    },
    status: {
        type: Boolean,
        default: true,
    },
    lastOnline:{
        type:String,
        default:''
    },
    loginIP:{
        type:String,
        default:''
    },
    detail:{
        photoStickers:{  // 4.5x3.5
            url: { 
                type: String, 
                trim: true, 
                default: 'img/photoStickers.png' 
            },
            original: { 
                type: String, 
                trim: true, 
                default: '' 
            }
        },
        phoneNumber:{
            type:String,
            default:''
        },
        address:{
            type:String,
            default:''
        },
        mailAddress:{
            type:String,
            default:''
        },
    }
});

const userModel = mongoose.model('User', userSchema);

module.exports = userModel;
