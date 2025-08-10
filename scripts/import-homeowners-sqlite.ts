import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import initSqlJs from 'sql.js'
import { Amplify } from 'aws-amplify'
import outputs from '../amplify_outputs.json' assert { type: 'json' }
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../amplify/data/resource'

Amplify.configure(outputs)
const client = generateClient<Schema>()

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const normalizePhone = (s?: string) => {
    if (!s) return undefined
    const d = s.replace(/\D/g,'')
    if (d.length===10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
    return s.trim()
}

function flag(args: string[], name: string){
    const ix = args.findIndex(a => a.toLowerCase() === `--${name}`)
    if (ix>=0 && args[ix+1] && !args[ix+1].startsWith('--')) return args[ix+1]
    const kv = args.find(a => a.toLowerCase().startsWith(`--${name}=`))
    return kv ? kv.split('=')[1] : undefined
}

function help(){
    console.log(`
Usage:
  npm run import:homeowners:sqlite -- --db <db.sqlite> --table <table> [--preview] \
[--street "col"] [--city "col"] [--state "col"] [--zip "col"] [--unit "col"] \
[--mailstreet "col"] [--mailcity "col"] [--mailstate "col"] [--mailzip "col"] \
[--ownerfirst "col"] [--ownerlast "col"] [--owneremail "col"] [--ownercell "col"] \
[--cofirst "col"] [--colast "col"] [--renterfirst "col"] [--renterlast "col"]

List tables:
  npm run import:homeowners:sqlite -- --db <db.sqlite> --list
`)}

function headerMap(cols: string[]){
    const m: Record<string,string> = {}
    for (const c of cols) m[norm(c)] = c
    return m
}
function pick(H: Record<string,string>, keys: string[], fuzzy?: (nk:string)=>boolean){
    for (const k of keys){ const real = H[norm(k)]; if (real) return real }
    if (fuzzy){ for (const [nk, real] of Object.entries(H)){ if (fuzzy(nk)) return real } }
    return undefined
}

async function main(){
    const args = process.argv.slice(2)
    const dbPath = flag(args,'db')
    const listOnly = args.includes('--list')
    const table = flag(args,'table')
    const preview = args.includes('--preview')
    if (!dbPath){ help(); process.exit(1) }

    const SQL = await initSqlJs({ locateFile: () => wasmPath })
    const bin = fs.readFileSync(path.resolve(dbPath))
    const db = new SQL.Database(new Uint8Array(bin))

    const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
    const tables: string[] = tablesRes[0]?.values?.map(v=>String(v[0])) || []

    if (listOnly){
        console.log('Tables:', tables)
        for (const t of tables){
            const info = db.exec(`PRAGMA table_info("${t.replace(/"/g,'""')}")`)
            const cols = info[0]?.values?.map(v=>String(v[1])) || []
            console.log(`\n[${t}] columns:`, cols)
        }
        return
    }

    if (!table){ console.error('Missing --table <name>. Use --list to see tables.'); process.exit(1) }

    const tQuoted = table.replace(/"/g,'""')
    const info = db.exec(`PRAGMA table_info("${tQuoted}")`)
    const columns = info[0]?.values?.map(v=>String(v[1])) || []
    if (!columns.length){ console.error(`Could not read columns for table ${table}`); process.exit(1) }
    const H = headerMap(columns)

    const streetKey = flag(args,'street') || pick(H, ['Property Address','Unit Address 1','Unit Address','Street Address','Address','Property Street','Service Address'], nk => nk.includes('address') && !nk.includes('mail') && !nk.includes('bill') && !nk.includes('city') && !nk.includes('state') && !nk.includes('zip') && !nk.includes('postal'))
    const cityKey   = flag(args,'city')   || pick(H, ['City','Unit Address City','Town'], nk => nk.endsWith('city'))
    const stateKey  = flag(args,'state')  || pick(H, ['State','Unit Address State','ST'])
    const zipKey    = flag(args,'zip')    || pick(H, ['Zip','Unit Address Zip Code','Postal Code','ZIP'], nk => nk.includes('postal'))
    const unitKey   = flag(args,'unit')   || pick(H, ['Unit Number','Unit','Apt','Apartment'])

    const mailStreetKey = flag(args,'mailstreet') || pick(H, ['Mailing Street','Billing Address 1','Mailing Address','Billing Address'], nk => nk.includes('mailingaddress')||nk.includes('billingaddress'))
    const mailCityKey   = flag(args,'mailcity')   || pick(H, ['Mailing City','Billing Address City'])
    const mailStateKey  = flag(args,'mailstate')  || pick(H, ['Mailing State','Billing Address State'])
    const mailZipKey    = flag(args,'mailzip')    || pick(H, ['Mailing Zip','Billing Address Zip Code','Mailing Postal','Billing Postal'])

    const ownerFirstKey = flag(args,'ownerfirst') || pick(H, ['Owner First Name','Primary Owner First Name','Occupant First Name','First Name'], nk => nk.includes('ownerfirst'))
    const ownerLastKey  = flag(args,'ownerlast')  || pick(H, ['Owner Last Name','Primary Owner Last Name','Occupant Last Name','Last Name'], nk => nk.includes('ownerlast'))
    const ownerEmailKey = flag(args,'owneremail') || pick(H, ['Owner Email','Contact Email','Email','Email Address'], nk => nk==='owneremail' || nk==='emailaddress')
    const ownerCellKey  = flag(args,'ownercell')  || pick(H, ['Cell Phone','Mobile Phone','Unit Phone','Phone'], nk => nk.includes('cell') || nk.includes('mobile'))

    const coFirstKey    = flag(args,'cofirst')    || pick(H, ['Secondary Owner First Name','Co-Owner First Name'])
    const coLastKey     = flag(args,'colast')     || pick(H, ['Secondary Owner Last Name','Co-Owner Last Name'])
    const renterFirstKey= flag(args,'renterfirst')|| pick(H, ['Renter First Name','Tenant First Name'])
    const renterLastKey = flag(args,'renterlast') || pick(H, ['Renter Last Name','Tenant Last Name'])

    if (preview){
        console.log('Table:', table)
        console.log('Columns:', columns)
        console.log('Column mapping:', { streetKey, cityKey, stateKey, zipKey, unitKey, mailStreetKey, mailCityKey, mailStateKey, mailZipKey, ownerFirstKey, ownerLastKey, ownerEmailKey, ownerCellKey, coFirstKey, coLastKey, renterFirstKey, renterLastKey })
        const res = db.exec(`SELECT * FROM "${tQuoted}" LIMIT 2`)
        const rows = (res[0]?.values || []).map(v=>Object.fromEntries(res[0].columns.map((c,i)=>[c, v[i]])))
        console.log('First 2 rows:', rows)
        return
    }

    if (!streetKey){
        console.error('Could not determine the property street/address column. Re-run with --preview, then pass --street "<Exact Column>" (and optionally --city/--state/--zip).')
        return
    }

    const res = db.exec(`SELECT * FROM "${tQuoted}"`)
    if (!res.length){ console.log('No rows found.'); return }
    const cols = res[0].columns
    const rows = res[0].values.map(v=>Object.fromEntries(cols.map((c,i)=>[c, v[i]]))) as Record<string, any>[]

    let homes=0, persons=0, skipped=0
    for (const row of rows){
        const street = streetKey ? String(row[streetKey] ?? '').trim() : ''
        if (!street){ skipped++; continue }
        const city = cityKey && row[cityKey] ? String(row[cityKey]) : 'Ashburn'
        const state = stateKey && row[stateKey] ? String(row[stateKey]) : 'VA'
        const postalCode = zipKey ? (row[zipKey] ? String(row[zipKey]) : undefined) : undefined
        const unitNumber = unitKey ? (row[unitKey] ? String(row[unitKey]) : undefined) : undefined
        const mailingStreet = mailStreetKey ? (row[mailStreetKey] ? String(row[mailStreetKey]) : undefined) : undefined
        const mailingCity = mailCityKey ? (row[mailCityKey] ? String(row[mailCityKey]) : undefined) : undefined
        const mailingState = mailStateKey ? (row[mailStateKey] ? String(row[mailStateKey]) : undefined) : undefined
        const mailingPostalCode = mailZipKey ? (row[mailZipKey] ? String(row[mailZipKey]) : undefined) : undefined
        const absenteeOwner = Boolean(mailingStreet && mailingStreet.trim() && (mailingStreet.trim() !== street.trim()))

        const { data: home } = await client.models.Home.create({ street, city, state, postalCode, unitNumber, mailingStreet, mailingCity, mailingState, mailingPostalCode, absenteeOwner })
        homes++

        const p1f = ownerFirstKey ? (row[ownerFirstKey] ? String(row[ownerFirstKey]) : undefined) : undefined
        const p1l = ownerLastKey ? (row[ownerLastKey] ? String(row[ownerLastKey]) : undefined) : undefined
        const p1e = ownerEmailKey ? (row[ownerEmailKey] ? String(row[ownerEmailKey]) : undefined) : undefined
        const p1m = ownerCellKey ? (row[ownerCellKey] ? String(row[ownerCellKey]) : undefined) : undefined
        if (p1f || p1l || p1e || p1m){
            await client.models.Person.create({ homeId: home.id, role: 'PRIMARY_OWNER', firstName: p1f, lastName: p1l, email: p1e, mobilePhone: normalizePhone(p1m) } as any)
            persons++
        }

        const p2f = coFirstKey ? (row[coFirstKey] ? String(row[coFirstKey]) : undefined) : undefined
        const p2l = coLastKey ? (row[coLastKey] ? String(row[coLastKey]) : undefined) : undefined
        if (p2f || p2l){
            await client.models.Person.create({ homeId: home.id, role:'SECONDARY_OWNER', firstName:p2f, lastName:p2l } as any)
            persons++
        }

        const rf = renterFirstKey ? (row[renterFirstKey] ? String(row[renterFirstKey]) : undefined) : undefined
        const rl = renterLastKey ? (row[renterLastKey] ? String(row[renterLastKey]) : undefined) : undefined
        if (rf || rl){
            await client.models.Person.create({ homeId: home.id, role:'RENTER', firstName:rf, lastName:rl } as any)
            persons++
        }
    }
    console.log(`Imported ${homes} homes and ${persons} people. Skipped rows: ${skipped}.`)
}
main().catch(err => { console.error(err); process.exit(1) })
