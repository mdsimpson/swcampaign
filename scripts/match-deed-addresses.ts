import * as fs from 'fs';
import * as path from 'path';

const dataDir = path.join(process.cwd(), '.data');
const deedNoMatchFile = path.join(dataDir, 'Deed_no_match.txt');
const parcelDataFile = path.join(dataDir, 'parcel_data.csv');
const outputFile = path.join(dataDir, 'deedup.csv');

// Read and parse Deed_no_match.txt to extract addresses
function extractAddressesFromDeedFile(): string[] {
  const content = fs.readFileSync(deedNoMatchFile, 'utf-8');
  const lines = content.split('\n');
  const addresses: string[] = [];

  for (const line of lines) {
    if (line.includes('CSV Address:')) {
      // Extract address between "CSV Address: " and " (Normalized:"
      const match = line.match(/CSV Address: (.+?) \(Normalized:/);
      if (match) {
        addresses.push(match[1].trim());
      }
    }
  }

  return addresses;
}

// Parse CSV line respecting quoted fields
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);

  return fields;
}

// Read parcel_data.csv and find matches
function findMatchesInParcelData(addresses: string[]): Map<string, { mailingAddress: string, name: string }> {
  const matches = new Map<string, { mailingAddress: string, name: string }>();
  const content = fs.readFileSync(parcelDataFile, 'utf-8');
  const lines = content.split('\n');

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const fields = parseCSVLine(lines[i]);
    const mailingAddress = fields[17]?.trim(); // Mailing Address column (index 17)
    const name = fields[18]?.trim(); // Name column (index 18)

    // Match against mailing address instead of the property address
    if (mailingAddress && addresses.includes(mailingAddress)) {
      matches.set(mailingAddress, { mailingAddress: mailingAddress || '', name: name || '' });
    }
  }

  return matches;
}

// Main execution
try {
  console.log('Extracting addresses from Deed_no_match.txt...');
  const addresses = extractAddressesFromDeedFile();
  console.log(`Found ${addresses.length} addresses to match`);

  console.log('Searching for matches in parcel_data.csv...');
  const matches = findMatchesInParcelData(addresses);
  console.log(`Found ${matches.size} matches`);

  console.log('Writing results to deedup.csv...');
  let csvContent = 'Mailing Address,Name\n';

  for (const [address, data] of matches) {
    csvContent += `${data.mailingAddress},"${data.name}"\n`;
  }

  fs.writeFileSync(outputFile, csvContent, 'utf-8');
  console.log(`Successfully wrote ${matches.size} matches to ${outputFile}`);
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
