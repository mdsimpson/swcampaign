import * as fs from 'fs'
import * as path from 'path'

interface FixData {
    residentId: string
    firstName: string
    lastName: string
    shouldBeAbsentee: boolean
    currentIsAbsentee: boolean
}

async function main() {
    const fixDataPath = path.join(process.cwd(), 'scripts/absentee-fixes.json')
    const residents2Path = path.join(process.cwd(), '.data/residents2.csv')
    
    // Load fix data
    const fixData: FixData[] = JSON.parse(fs.readFileSync(fixDataPath, 'utf8'))
    
    // Get IDs to fix (set isAbsentee to false)
    const idsToFix = new Set(fixData.filter(f => !f.shouldBeAbsentee).map(f => f.residentId))
    
    console.log(`Fixing ${idsToFix.size} resident records in residents2.csv...`)
    
    // Read and update residents2.csv
    const content = fs.readFileSync(residents2Path, 'utf8')
    const lines = content.split('\n')
    const header = lines[0]
    const dataLines = lines.slice(1)
    
    let fixedCount = 0
    const updatedLines = dataLines.map(line => {
        if (!line.trim()) return line
        
        const parts = line.split(',')
        const id = parts[0]?.trim()
        
        if (idsToFix.has(id)) {
            // Update the isAbsentee field (last column) from 'true' to 'false'
            const lastIndex = parts.length - 1
            if (parts[lastIndex]?.trim() === 'true') {
                parts[lastIndex] = 'false'
                fixedCount++
                console.log(`Fixed: ID ${id} - ${parts[1]} ${parts[2]} (set isAbsentee to false)`)
            }
        }
        
        return parts.join(',')
    })
    
    // Write back to file
    const updatedContent = [header, ...updatedLines].join('\n')
    fs.writeFileSync(residents2Path, updatedContent)
    
    console.log(`\nFixed ${fixedCount} records in residents2.csv`)
}

main().catch(console.error)