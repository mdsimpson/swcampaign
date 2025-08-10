import fs from 'node:fs'
import path from 'node:path'
import {parse} from 'csv-parse/sync'
import {Amplify} from 'aws-amplify'
import outputs from '../amplify_outputs.json' assert {type: 'json'}
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../amplify/data/resource'

Amplify.configure(outputs)
const client = generateClient<Schema>()
type Row = Record<string, string>

async function main() {
    const csvPath = process.argv[2];
    if (!csvPath) {
        console.error('Usage: npm run import:votes -- /path/to/Votes.csv');
        process.exit(1)
    }
    const raw = fs.readFileSync(path.resolve(csvPath), 'utf8')
    const records: Row[] = parse(raw, {columns: true, skip_empty_lines: true})
    let count = 0
    for (const row of records) {
        const personId = row['personId'] || row['PersonId']
        const homeId = row['homeId'] || row['HomeId']
        const choice = (row['choice'] || row['Choice'] || '').toUpperCase()
        if (!personId || !homeId || !choice) continue
        await client.models.Vote.create({
            personId,
            homeId,
            choice,
            recordedAt: new Date().toISOString(),
            source: 'bulk-upload' as any
        })
        await client.models.Person.update({
            id: personId,
            hasVoted: true,
            voteChoice: choice as any,
            votedAt: new Date().toISOString()
        })
        count++
    }
    console.log(`Imported ${count} vote rows.`)
}

main().catch(err => {
    console.error(err);
    process.exit(1)
})
