import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

interface Resident {
  id: string;
  'Occupant First Name': string;
  'Occupant Last Name': string;
  'Occupant Type': string;
  Street: string;
  City: string;
  State: string;
  Zip: string;
  address_id: string;
  'Contact Email': string;
  'Additional Email': string;
  'Cell Phone': string;
  'Cell Phone Resident Alert Emergency': string;
  'Unit Phone': string;
  'Work Phone': string;
  'Is Absentee': string;
}

const residentsPath = path.join(process.cwd(), '.data', 'residents2.csv');
const badEmailsPath = path.join(process.cwd(), '.data', 'bad-emails.csv');

// Read bad emails
const badEmailsContent = fs.readFileSync(badEmailsPath, 'utf-8');
const badEmails = new Set(
  badEmailsContent
    .split('\n')
    .map(line => line.trim().toLowerCase())
    .filter(line => line.length > 0)
);

// Read residents
const residentsContent = fs.readFileSync(residentsPath, 'utf-8');
const residents = parse(residentsContent, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
}) as Resident[];

// Filter for absentee residents with no email or bad email
const matches = residents.filter(resident => {
  const isAbsentee = resident['Is Absentee']?.toLowerCase() === 'true';
  if (!isAbsentee) return false;

  const email = resident['Contact Email']?.trim().toLowerCase();
  const hasNoEmail = !email || email === '';
  const hasBadEmail = email && badEmails.has(email);

  return hasNoEmail || hasBadEmail;
});

// Output results
const output: string[] = [];
output.push(`Total absentee residents with no email or bad email: ${matches.length}\n`);
output.push('List of matching residents:\n');

matches.forEach((resident, index) => {
  const email = resident['Contact Email']?.trim() || '(no email)';
  const emailStatus = email === '(no email)' ? 'NO EMAIL' : 'BAD EMAIL';

  output.push(`${index + 1}. ${resident['Occupant First Name']} ${resident['Occupant Last Name']}`);
  output.push(`   Address: ${resident.Street}, ${resident.City}, ${resident.State} ${resident.Zip}`);
  output.push(`   Email: ${email} [${emailStatus}]`);
  output.push('');
});

output.push(`\nTotal count: ${matches.length}`);

const outputText = output.join('\n');
console.log(outputText);

// Write to file
const outputPath = path.join(process.cwd(), '.data', 'absentee-noemail.txt');
fs.writeFileSync(outputPath, outputText, 'utf-8');
console.log(`\nResults written to: ${outputPath}`);

// Write CSV file
const csvLines: string[] = [];
csvLines.push('First Name,Last Name,Street,City,State,Zip,Email,Status');

matches.forEach(resident => {
  const firstName = resident['Occupant First Name'] || '';
  const lastName = resident['Occupant Last Name'] || '';
  const street = resident.Street || '';
  const city = resident.City || '';
  const state = resident.State || '';
  const zip = resident.Zip || '';
  const email = resident['Contact Email']?.trim() || '';
  const status = email === '' ? 'NO EMAIL' : 'BAD EMAIL';

  // Escape fields that contain commas
  const escapeField = (field: string) => {
    if (field.includes(',') || field.includes('"')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  csvLines.push(
    [firstName, lastName, street, city, state, zip, email, status]
      .map(escapeField)
      .join(',')
  );
});

const csvPath = path.join(process.cwd(), '.data', 'absentee-noemail.csv');
fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
console.log(`CSV written to: ${csvPath}`);
