import { checkMigration, formatReport } from '../src/index.js';
const report=await checkMigration({
 fixtures:[{name:'old cart',value:{version:1,items:['book']}}],
 migrate:cart=>({...cart,version:2}),
 validate:cart=>cart.version===2 && Array.isArray(cart.items),
 preserve:cart=>cart.items,
});
console.log(formatReport(report));
process.exitCode=report.passed?0:1;
