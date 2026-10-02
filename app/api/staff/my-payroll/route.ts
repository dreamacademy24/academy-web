import {GET as getPayroll,POST as postPayroll} from '@/app/api/hr/payroll/route'
export const dynamic='force-dynamic'
// Never forward an HR bearer token from the employee-only surface.
function employeeRequest(req:Request){const headers=new Headers(req.headers);headers.delete('authorization');return new Request(req,{headers})}
export async function GET(req:Request){return getPayroll(employeeRequest(req))}
export async function POST(req:Request){return postPayroll(employeeRequest(req))}

