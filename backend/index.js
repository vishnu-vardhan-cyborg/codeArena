const express=require('express');
const cors=require('cors');

const app=express();
app.use(cors());
app.use(express.json());


app.post('/run/problem',(req,res)=>{
    const {code,language,testcases}=req.body;
    console.log(code,language,testcases);
    res.json({message:'Code received successfully'});
    
});


app.listen(9000,()=>{
    console.log('Server is running on port 3000');
})