import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Address abbreviation mapping
const ABBREVIATION_MAP: Record<string, string[]> = {
    'avenue': ['ave', 'av'],
    'boulevard': ['blvd', 'boul'],
    'circle': ['cir'],
    'court': ['ct'],
    'drive': ['dr'],
    'lane': ['ln'],
    'place': ['pl'],
    'road': ['rd'],
    'square': ['sq'],
    'street': ['st'],
    'terrace': ['ter'],
    'trail': ['trl'],
}

// Create reverse mapping (abbreviation -> full word)
const REVERSE_MAP: Record<string, string> = {}
Object.entries(ABBREVIATION_MAP).forEach(([full, abbrs]) => {
    abbrs.forEach(abbr => {
        REVERSE_MAP[abbr] = full
    })
    REVERSE_MAP[full] = full
})

function normalizeAddress(address: string): string {
    // Convert to lowercase and trim
    let normalized = address.toLowerCase().trim()

    // Split into parts
    const parts = normalized.split(/\s+/)

    // Normalize the last word (typically the street type)
    if (parts.length > 0) {
        const lastPart = parts[parts.length - 1]
        if (REVERSE_MAP[lastPart]) {
            parts[parts.length - 1] = REVERSE_MAP[lastPart]
        }
    }

    return parts.join(' ')
}

async function filterParcelData() {
    const address2Path = path.join(__dirname, '../.data/address2.csv')
    const parcelDataPath = path.join(__dirname, '../.data/parcel_data.csv')
    const outputPath = path.join(__dirname, '../.data/parcel_data_filtered.csv')

    console.log('Reading address2.csv...')
    const address2Content = fs.readFileSync(address2Path, 'utf-8')
    const address2Parsed = Papa.parse(address2Content, {
        header: true,
        skipEmptyLines: true
    })

    // Build a set of normalized addresses from address2.csv
    const dbAddresses = new Set<string>()
    address2Parsed.data.forEach((row: any) => {
        const street = row.Street?.trim()
        if (street) {
            const normalized = normalizeAddress(street)
            dbAddresses.add(normalized)
        }
    })

    console.log(`Found ${dbAddresses.size} unique addresses in database`)

    console.log('Reading parcel_data.csv...')
    const parcelContent = fs.readFileSync(parcelDataPath, 'utf-8')
    const parcelParsed = Papa.parse(parcelContent, {
        header: true,
        skipEmptyLines: true
    })

    // Filter parcel data to only include addresses that exist in the database
    const matchedRows: any[] = []
    const unmatchedRows: any[] = []

    parcelParsed.data.forEach((row: any) => {
        const mailingAddress = row['Mailing Address']?.trim()
        if (mailingAddress) {
            const normalized = normalizeAddress(mailingAddress)
            if (dbAddresses.has(normalized)) {
                matchedRows.push(row)
            } else {
                unmatchedRows.push({
                    mailingAddress,
                    normalized,
                    name: row['Name']
                })
            }
        }
    })

    console.log(`\nResults:`)
    console.log(`- Matched: ${matchedRows.length} records`)
    console.log(`- Unmatched: ${unmatchedRows.length} records`)

    // Write the filtered CSV
    const csvContent = Papa.unparse(matchedRows)
    fs.writeFileSync(outputPath, csvContent, 'utf-8')
    console.log(`\n✓ Filtered parcel data written to: ${outputPath}`)

    // Also write a summary of unmatched addresses
    const unmatchedSummaryPath = path.join(__dirname, '../.data/parcel_data_unmatched.txt')
    const unmatchedContent = unmatchedRows.map((row, index) =>
        `${index + 1}. ${row.mailingAddress}\n   Normalized: ${row.normalized}\n   Deed Name: ${row.name}`
    ).join('\n\n')
    fs.writeFileSync(unmatchedSummaryPath, unmatchedContent, 'utf-8')
    console.log(`✓ Unmatched addresses summary written to: ${unmatchedSummaryPath}`)

    console.log(`\n📊 Summary:`)
    console.log(`   Database addresses: ${dbAddresses.size}`)
    console.log(`   Parcel records: ${parcelParsed.data.length}`)
    console.log(`   Matched: ${matchedRows.length} (${Math.round(matchedRows.length / dbAddresses.size * 100)}% of database)`)
    console.log(`   Unmatched: ${unmatchedRows.length}`)
}

filterParcelData().catch(console.error)
