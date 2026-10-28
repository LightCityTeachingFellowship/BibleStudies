import {runLocalSync} from './studio-local-sync.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
runLocalSync(root,{once:process.argv.includes('--once')}).catch(error=>{console.error(error.message);process.exitCode=1;});