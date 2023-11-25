
const express = require('express');
const path = require('path');
const nj = require('numjs');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs').promises;
const app = express();
const PORT = 3000;
const OPENAI_API_KEY = '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'; 
const OpenAI = require("openai");
const PDF_PATH = 'D:/Pawan/AI-bot/count.txt'; 
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY 
  });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/getOpenAIResponse', async (req, res) => {
    const userMessage = req.body.message;

    try {
        const openAIResponse = await getAiResponse(userMessage);
        res.json({ botResponse: openAIResponse.choices[0].message.content });
    } catch (error) {
        console.error('OpenAI API error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
async function getAiResponse(userMessage) {
    const completion = await openai.chat.completions.create({
        model:"gpt-3.5-turbo",
        temperature:0.7,
        max_tokens:1024,
        n:1,
        messages:[{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: userMessage }],
         
    });
    console.log(completion.choices[0].message.content);
    return completion;
  }

var textInfo = ''
async function generatePdfEmbedding(userMessage) {
    try {
        const fileCount = await fs.readFile(PDF_PATH, 'utf-8');
       
        
        const completion = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: userMessage,
            temperature:0.7,
            max_tokens:1024,
            n:1,
           
             
        });
        //console.log(completion['data'][0]['embedding'].toString())
        var data = "Text : "+userMessage +" Embedding : "+completion['data'][0]['embedding'].toString();
        var filename = parseInt(fileCount)+1
        if(userMessage.toLowerCase().includes("note to remember")){
        await fs.writeFile('D:/Pawan/AI-bot/Database/'+filename.toString()+'.txt', data, 'utf-8');
        await fs.writeFile('D:/Pawan/AI-bot/count.txt', filename.toString(), 'utf-8');}
        var similarity_score = -1
        for (let i = 1; i < filename; i=i+1) {
            const file = await fs.readFile('D:/Pawan/AI-bot/Database/'+i+'.txt', 'utf-8');
            
            var loc = file.indexOf('Embedding :')+'Embedding : '.length
            //console.log(file.substring(loc,file.length)); 
            const floatArray = file.substring(loc,file.length).split(',').map(parseFloat);
            var newsimilarity_score =  nj.dot(floatArray, completion['data'][0]['embedding'])
                if(similarity_score<newsimilarity_score || similarity_score==-1){
                    similarity_score=newsimilarity_score
                    textInfo = file.substring(7,loc-12)
                }
               // console.log(similarity_score);
            //console.log(newsimilarity_score);
        }
       

        console.log('PDF embedding generated successfully');
    } catch (error) {
        console.error('Error generating PDF embedding:', error.message);
    }
}

app.post('/getDomainSpecificResponse', async (req, res) => {
    const userMessage = req.body.message;

    try {
        
        await generatePdfEmbedding(userMessage);
        if(!userMessage.toLowerCase().includes("note to remember")){
        const openAIResponse = await getDomainSpecificResponse(userMessage);
        res.json({ botResponse: openAIResponse.choices[0].text });}
        else{
        res.json({ botResponse: "Sure, I have stored this information in my Database." });}
    } catch (error) {
        console.error('OpenAI API error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function getDomainSpecificResponse(userMessage) {
    console.log("Relavent Info : "+textInfo);
    const finalPrompt = `
  Info: ${textInfo}
  Question: ${userMessage}
  Answer:
`;

// ask Open AI to answer the prompt
const response = await openai.completions.create({
  model: "text-davinci-003",
  prompt: finalPrompt,
  max_tokens: 64,
});
console.log(userMessage);
    return response;
}
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

let pdfContents = [];

app.post('/upload-pdf', upload.array('txt', 5), async (req, res) => {
    try {
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        pdfContents = files.map(file => file.buffer.toString('utf-8'));
        for(i in pdfContents){
            pdfContents[i]= "Note to remember : "+pdfContents[i]
        }
        
        console.log(pdfContents )
        res.json({ message: pdfContents[0] });
    } catch (error) {
        console.error('Error uploading PDFs:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

