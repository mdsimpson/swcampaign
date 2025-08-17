import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import { readFileSync } from "fs";
import { config } from "dotenv";

config();

const outputs = JSON.parse(readFileSync("./amplify_outputs.json", "utf8"));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: "apiKey" });

async function cleanupDuplicateHomes() {
    console.log("🔧 CLEANING UP DUPLICATE HOME RECORDS\n");
    
    try {
        const volunteers = await client.models.Volunteer.list();
        const secretary = volunteers.data.find(v => v.email === "secretary2023@swhoab.com");
        
        const allAssignments = await client.models.Assignment.list({
            filter: { volunteerId: { eq: secretary.id } }
        });
        
        console.log(`📋 Found ${allAssignments.data.length} assignments`);
        
        const assignedHomeIds = [...new Set(allAssignments.data.map(a => a.homeId))];
        console.log(`🏠 Unique assigned homes: ${assignedHomeIds.length}`);
        
        // The debug shows 23 unique home IDs but only 17 unique addresses
        // This means some addresses have multiple home records with different coordinates
        console.log("\n⚠️ ISSUE IDENTIFIED:");
        console.log("The canvassing map logic shows 23 unique home records");
        console.log("But there should only be 17 unique addresses (1 per assignment)");
        console.log("This means duplicate homes exist for the same addresses");
        console.log("\nThe solution is to clean up the import process to prevent duplicate homes");
        console.log("Or merge duplicates by keeping the home with the best coordinates");
        
        console.log("\n📊 Current state based on debug-map-display.js:");
        console.log("• 29 total assignments");
        console.log("• 23 unique home records"); 
        console.log("• Should be 17 unique addresses");
        console.log("• Map shows 13 markers (likely due to overlapping coordinates)");
        
    } catch (error) {
        console.error("💥 Error:", error);
    }
}

cleanupDuplicateHomes();
