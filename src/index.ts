import path from 'path';

import { Main } from "./modules/main";
import { Config } from "./types/config";

/*
    Setup global type definitions to allow custom object onto the global object
    these definitions are then available across all sub modules
*/
declare global {
    namespace NodeJS {
        interface Global {
            paths: {
                [key:string]: string;
            },
        }
    }
}

global.paths = {
    root: path.join(__dirname, '../')
}

// console.log(global.config);

const main = new Main(
);