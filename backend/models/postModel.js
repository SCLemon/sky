const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    createTime:String,
    idx:{
        type: String,
        required:true,
        unique: true,
        trim: true,
    },
    creator:{
        type: {
            idx:String,
            name:String,
            userImgUrl:String,
        },
        required:true,
        trim: true,
    },
    group:{
        type: String,
        required:true,
        trim: true,
    },
    content:{
        type: String,
        trim: true,
        default:''
    },
    databaseUrl:{
        type: String,
        required:true,
        trim: true,
        unique: true,
    },
    status: {
        type: Boolean,
        default: true,
    },
    meta:{
        like:{
            type:[
                {
                    idx:{
                        type:String,
                    }
                }
            ],
            default:[]
        },
        message:{
            type:[
                {
                    ip:String,
                    message:String
                }
            ],
            default:[]
        }
    }
});
const postModel = mongoose.model('posts', postSchema);

module.exports = postModel;

