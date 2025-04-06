const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    createTime:String,
    idx:{
        type: String,
        required:true,
        unique: true,
        trim: true,
    },
    folderPath:{
        type: String,
        require:true,
        trim: true,
        default:''
    },
    courseId:{
        type: String,
        required:true,
        trim: true,
    },
    courseName:{
        type: String,
        default: true,
    },
    courseTime:{ // 上課時間
        type:[{
            weekday:{
                type: String,
                require:true
            },
            period:{
                type:[[Date]],
                require:true,
            }
        }],
        require:true,
        trim:true,
    },
    lecturer:{
        type: String,
        default: true,
    },
    group:{
        type: String,
        required:true,
        trim: true,
    },
    status: {
        type: Boolean,
        default: true,
    },
    meta: { 
        type: [{
            idx:String,
            title:String,
            abstract:String,
            videoSrc:String,
            attachmentUrl:{
                name:String,
                url:String,
                original:String,
            }
        }],
        default: []
    },
    studentList:{
        type:[String],
        default:[]
    }
});

const courseModel = mongoose.model('Course', courseSchema);

module.exports = courseModel;
