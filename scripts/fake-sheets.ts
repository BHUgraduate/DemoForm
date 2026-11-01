// Local Google Sheets emulator for rehearsing the demo WITHOUT Google credentials.
//   npx tsx scripts/fake-sheets.ts            (listens on :4010)
//   GOOGLE_SHEETS_EMULATOR_URL=http://127.0.0.1:4010 GOOGLE_SHEETS_SPREADSHEET_ID=demo-sheet npm start
// "Edit the sheet":  curl -XPOST localhost:4010/__control/set -H 'content-type: application/json' \
//                         -d '{"id":"REL-2026-00004","column":"O","value":"Approved"}'
// "See the sheet":   curl localhost:4010/__control/dump
import { FakeSheets } from '../tests/helpers/fakeSheets.ts';

const port = Number(process.env.FAKE_SHEETS_PORT || 4010);
const fake = new FakeSheets(process.env.GOOGLE_SHEETS_SPREADSHEET_ID || 'demo-sheet');
await fake.start(port);
console.log(`Fake Google Sheets API on ${fake.url}  (spreadsheet id: ${fake.spreadsheetId})`);
