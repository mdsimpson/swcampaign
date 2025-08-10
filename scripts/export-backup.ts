import fs from 'node:fs'
import path from 'node:path'
import {Amplify} from 'aws-amplify'
import outputs from '../amplify_outputs.json' assert {type: 'json'}
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../amplify/data/resource'

Amplify.configure(outputs)
const client = generateClient<Schema>()

async function dumpAll(model: any, name: string) {
    let token: string | null | undefined = undefined;
    const all: any[] = [];
    do {
        const {data, nextToken} = await model.list({limit: 200, nextToken: token || undefined});
        all.push(...data);
        token = nextToken
    } while (token);
    fs.writeFileSync(path.resolve(`./backup_${name}.json`), JSON.stringify(all, null, 2));
    console.log(`Wrote backup_${name}.json (${all.length} rows)`)
}

async function main() {
    await dumpAll(client.models.Home, 'Home');
    await dumpAll(client.models.Person, 'Person');
    await dumpAll(client.models.Assignment, 'Assignment');
    await dumpAll(client.models.InteractionRecord, 'InteractionRecord');
    await dumpAll(client.models.Vote, 'Vote');
    await dumpAll(client.models.Registration, 'Registration');
    await dumpAll(client.models.UserProfile, 'UserProfile')
}

main().catch(err => {
    console.error(err);
    process.exit(1)
})
