import { AntiRecoil } from "./anti-recoil";
import { app, BrowserWindow, ipcMain } from "electron";
import { namehash, normalise } from "./normalise";

import { ENS } from '@ensdomains/ensjs';
// import { ethers } from 'ethers'
export class Main {

    constructor(  ){
        new AntiRecoil();

    }



}