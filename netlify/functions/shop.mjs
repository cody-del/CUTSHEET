import {Pool} from 'pg';
import {postgresStore} from '../../shop-store.mjs';
import {createShopService} from '../../shop-service.mjs';
import {shopHandler} from '../../shop-api.mjs';

export const config={path:'/api/shop/*'};
const connectionString=process.env.CUTSHEET_DATABASE_URL||process.env.NETLIFY_DB_URL;
const pool=connectionString?new Pool({connectionString,max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:8000}):null;
pool?.on('error',()=>{}); // Request handlers report a safe, actionable connection error.
export default shopHandler(createShopService({store:pool?postgresStore(pool):null,
  password:process.env.CUTSHEET_OWNER_PASSWORD,secret:process.env.CUTSHEET_SESSION_SECRET}));
