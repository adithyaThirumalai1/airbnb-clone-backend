import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import mongoose from 'mongoose';
import bcrypt from 'bcrypt'
import imageDownloader from 'image-downloader';
import multer from 'multer';
import fs from "fs"

import User from './models/User.js';
import Place from './models/Place.js';
import Booking from './models/Booking.js';

// For getting the current directory name
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
//////////

const salt = bcrypt.genSaltSync(10);

//const jwtSecret="bfudsjbdfsnfghhj";

const app=express();
const PORT=process.env.PORT || 5000;

// ********** MIDDLEWARES ***********
app.use(express.json());
app.use(cors({
    credentials:true,
    origin:"http://localhost:3000"
}));
app.use("/uploads",express.static(__dirname+"/uploads"))
//app.use(cookieParser())



await mongoose.connect(process.env.MONGO_URL).then(()=> console.log("DB connection established"));

app.get("/test",(req,res)=>{
    res.send("Test Successful")
})

// Registration of a new user
app.post("/register",async (req,res)=>{
    const {name,email,password} =req.body;

    try{
        // We will first encrypt the password before storing it in the DB
        const encryptedPassword=bcrypt.hashSync(password,salt);
        const user=await User.create({
            name,
            email,
            password:encryptedPassword
        });
    
        res.json(user);
    }
    catch (e){
        res.status(422).json(e);
    }
})

app.post("/login",async (req,res)=>{
    const {email,password} =req.body;

    // Check whether a user exists for the current email
    const userDoc=await User.findOne({email:email});
    // If the user is found
    if(userDoc){
        // Check if password matches
        const passwordMatches=bcrypt.compareSync(password,userDoc.password);
        if(passwordMatches){
            const {name,email,_id}=userDoc;

            res.json({name:name,email:email,id:_id});
        }
        else{
            res.status(422).json("Password incorrect for the current user")
        }
    }
    // No such user exists with this email.
    else{
        res.status(422).json("User not found in DB")
    }
})

// Obsolete because we are not using cookies for user information anymore.
app.post("/logout",(req,res)=>{
    // We will clear the token value
    res.cookie("token","").json(true);
})

app.post("/upload-by-link",async (req,res)=>{
    const {link}=req.body;
    const newName="photo"+Date.now()+".jpg";
    await imageDownloader.image({
        url:link,
        dest:__dirname+"/uploads/"+newName
    })
    res.json(newName);
})

const photosMiddleware=multer({dest:"uploads/"});
app.post("/upload",photosMiddleware.array("photos",100),(req,res)=>{
    let uploadedFiles=[];
    // The files are being stored but without .extensions so we will have to manually add them. 
    for(let i=0;i<req.files.length;i++){
        const {path,originalname}=req.files[i];
        // The originalname field will have the extension of the orginal file.
        // We will extract that and append it
        const parts=originalname.split(".");
        const ext=parts[parts.length-1]; // The extension will be present at the end
        const newPath=path+"."+ext;
        fs.renameSync(path,newPath);
        uploadedFiles.push(newPath.replace("uploads/",""));
    }
    res.json(uploadedFiles);
})

app.post("/places",async (req,res)=>{
    const {title,address,addedPhotos,description,perks,extraInfo,checkIn,checkOut,maxGuests,price,user_id} = req.body;

    try{
        const placeDoc=await Place.create({
            owner:user_id,
            title,address,photos:addedPhotos,
            description,perks,extraInfo,checkIn,checkOut,maxGuests,price
        });
        res.json(placeDoc);
    }
    catch(e){
        res.json("Failed to upload to DB with error: "+e)
    }
})

app.get("/user_places",async (req,res)=>{
    const id=req.query.id;
    const placeDoc=await Place.find({owner:id})
    res.json(placeDoc);
})

app.get("/places/:id",async (req,res)=>{
    //console.log(req.params);
    const {id}=req.params;
    res.json(await Place.findById(id));
})

app.put("/places", async (req,res)=>{
    // Getting all the info
    const {id,title,address,addedPhotos,description,perks,extraInfo,checkIn,checkOut,maxGuests,price,user_id} = req.body;
    // Verify whether the curr place belongs to the curr user
    const placeDoc=await Place.findById(id);
    if(placeDoc.owner.toString()===user_id){
        placeDoc.set({
            title,address,photos:addedPhotos,
            description,perks,extraInfo,checkIn,checkOut,maxGuests,price
        });
        await placeDoc.save();
        res.json("ok");
    }
    else{
        res.json("Not authorized to make changes");
    }
})

app.get("/places",async (req,res)=>{
    res.json(await Place.find());
})

app.post("/bookings",async (req,res)=>{
    const {place,checkIn,checkOut,numOfGuests,fullName,phone,price,user}=req.body;
    try{
        const bookingDoc=await Booking.create({user,place,checkIn,checkOut,numOfGuests,fullName,phone,price});
        console.log(bookingDoc);
        res.json(bookingDoc);
    }
    catch(err){
        console.log(err);
        res.json(err);
    }
})

app.get("/bookings",async (req,res)=>{
    try{
        const {id}=req.query;
        const bookingDoc=await Booking.find({user:id}).populate("place");
        res.json(bookingDoc);
    }
    catch(err){
        res.json(err);
    }
})

app.listen(PORT,()=>{
    console.log(`Server running at port: ${PORT}`);
})