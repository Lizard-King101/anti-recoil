import * as os from 'os';
os.setPriority(os.constants.priority.PRIORITY_HIGH);

import nanotimer from "nanotimer";
import { uIOhook as Hook, UiohookKey as Keys } from "uiohook-napi";
import { Interception, FilterMouseState, Mouse, MouseStroke, MouseFlag, MouseState } from 'node-interception';

import notifier from "node-notifier";
let gun: Gun = {
    name: "AK",
    rpm: 450,
    recoils: [
        {
            name: 'Default',
            multipliers: [.1, .09],
            vecors: [[-.25, 1], [-.25, 1],[-.26, 1],[-.28, 1],[-.3, 1],[-.65, 1]]
        },
        {
            name: 'Crouch',
            activate: [Keys.Ctrl],
            multipliers: [.08, .06],
            vecors: [[-.24, .8], [-.24, .8],[-.25, .8],[-.26, .8],[-.28, .8],[-.3, .79]]
        },
        {
            name: 'ADS',
            activate: ['right'],
            multipliers: [.11, .1],
            vecors: [[-.26, 1], [-.26, 1],[-.27, 1],[-.28, 1],[-.3, .98],[-.60, .95]]
        },
        {
            name: 'Crouch ADS',
            activate: [Keys.Ctrl, 'right'],
            multipliers: [.07, .050],
            vecors: [[-.24, .99], [-.25, .96],[-.26, .95],[-.28, .94],[-.295, .94],[-.5, .93]]
        }
    ],
    mode: 'end',
}
let config = {
    pause: [Keys.Shift]
}

const fps = 60;

export class AntiRecoil {
    timer:nanotimer = new nanotimer();
    interception?: Interception;
    mouse?: Mouse;
    
    private keysPressed: {[key:number]: true | undefined} = {};
    private hotkeys: Array<Hotkey> = [];

    leftMouse: boolean = false;
    rightMouse: boolean = false;

    nextShot: number = 0;
    shots: number = 0;
    currentVector: [number, number] = [0,0];

    time = {
        last: 0,
        now: 0,
        delta: 0
    }
    
    private _recoil?: Recoil;
    get recoil(): Recoil {
        return this._recoil ? this._recoil : gun.recoils[0];
    }

    private _enabled: boolean = false;
    set enabled(val: boolean) {
        if(this._enabled !== val) {
            this._enabled = val;
            if(val) {
                notifier.notify({
                    title: 'Anti Recoil',
                    message: 'Recoil Control Enabled'
                })
                this.listen().catch(console.error);
            } else {
                notifier.notify({
                    
                    title: 'Anti Recoil',
                    message: 'Recoil Control Disabled'
                })
            }
        }
    }
    get enabled(): boolean {return this._enabled}

    constructor() {
        console.log('AntiRecoil');
        
        Hook.on('keydown', (e) => {
            switch(e.keycode) {
                case Keys.Escape:
                    this.enabled = false;
                    break;
            }
            if(!this.keysPressed[e.keycode]) {
                this.keysPressed[e.keycode] = true;
                if(Object.keys(this.keysPressed).length > 1) this.checkHotkeys();
                this.checkRecoil();
            }
        })

        Hook.on('keyup', (e) => {
            delete this.keysPressed[e.keycode];
            this.checkRecoil();
        })

        this.addHotkeys([Keys.Enter, Keys.NumpadAdd], () => {this.enabled = !this.enabled});

        Hook.start();
    }

    async listen() {
        this.interception = new Interception();
        this.interception.setFilter('mouse', FilterMouseState.ALL);
        this.mouse = this.interception.getMice()[0]
        this.timer.setInterval(this.update.bind(this), '', 1000/fps + 'm');

        while(this.enabled) {
            const device = await this.interception.wait();
            const stroke = device?.receive();
            
            if(stroke?.type == "mouse") {
                let s = <MouseStroke>stroke;
                switch(stroke.state) {
                    case 1:
                        // left mouse down
                        this.leftMouse = true;
                        this.checkRecoil();
                        this.mouse.send(stroke);
                        break;
                    case 2:
                        // left mouse up
                        this.leftMouse = false;
                        this.checkRecoil();
                        this.mouse.send(stroke);
                        this.clearShooting();
                        break;
                    case 4:
                        this.rightMouse = true;
                        this.checkRecoil();
                        this.mouse.send(stroke);
                        break;
                    case 8:
                        this.rightMouse = false;
                        this.checkRecoil();
                        this.mouse.send(stroke);
                        break;
                    case 1024:
                        this.mouse.send(stroke);
                        break;
                    default:
                        this.mouse.send(s);
                }
            }
        }

        this.interception.destroy();
        this.timer.clearInterval();
    }

    update() {
        this.time.now = new Date().getTime();
        if(this.time.last) this.time.delta = this.time.now - this.time.last;
        let recoil = this.recoil;

        if(this.leftMouse) {
            if(this.nextShot <= 0) {
                let shotVector: [number, number] = [0,0];
                switch(gun.mode) {
                    case 'loop':
                        shotVector = recoil.vecors[this.shots % recoil.vecors.length];
                        break;
                    case 'start':
                        if(this.shots > recoil.vecors.length - 1) shotVector = recoil.vecors[0];
                        else shotVector = recoil.vecors[this.shots];
                        break;
                    case 'end':
                        shotVector = this.shots > recoil.vecors.length - 1 ? recoil.vecors[recoil.vecors.length - 1] : recoil.vecors[this.shots];
                        break;
                }

                this.shots++;
                this.currentVector = shotVector;
                this.nextShot = 1000 * 60 / gun.rpm;
            } else {
                this.nextShot - this.time.delta > 0 ? this.nextShot -= this.time.delta : this.nextShot = 0;
            }

            if(this.currentVector[0] > 0 || this.currentVector[1] > 0) {
                // move mouse
                let t = 1 - (this.nextShot / (1000 * 60 / gun.rpm))
                let ease = this.easeOutQuint(t);
                
                let [mouseX, mouseY] = this.currentVector.map((v, i) => (v * recoil.multipliers[i] * ease) * (1000 / this.time.delta));
                
                this.mouse?.send({
                    type: 'mouse',
                    flags: MouseFlag.MOVE_RELATIVE,
                    x: mouseX,
                    y: mouseY,
                    rolling: 0,
                    state: MouseState.BUTTON_1_DOWN,
                    information: 0
                })
            } else {
                console.log('No Vec');
            }
        }
        
        this.time.last = this.time.now;
        return;
    }

    checkRecoil() {
        let inputCount = (this.leftMouse ? 1 : 0) + (this.rightMouse ? 1 : 0) + Object.keys(this.keysPressed).length;
        if(inputCount) {
            let sortedRecoils = gun.recoils.slice().sort((a,b) => {
                let aLeng = a.activate ? a.activate.length : 0;
                let bLeng = b.activate ? b.activate.length : 0;
                return aLeng < bLeng ? 1 : bLeng < aLeng ? -1 : 0;
            });
            
            for(let recoil of sortedRecoils) {
                let valid = true;
                if(recoil.activate) {
                    for(let input of recoil.activate) {
                        if(typeof input == 'string') {
                            switch(input) {
                                case 'left':
                                    valid = this.leftMouse;
                                    break;
                                case 'right':
                                    valid = this.rightMouse;
                                    break;
                            }
                        } else {
                            valid = this.keysPressed[input] != undefined;
                        }
                        if(!valid) break;
                    }
                } else valid = false;
                
                if(valid) {
                    this._recoil = recoil;
                    console.log('Recoil', this.recoil.name);
                    return;
                }
            }
        }
        this._recoil = undefined;
    }

    clearShooting() {
        this.leftMouse = false;
        this.shots = 0;
        this.nextShot = 0;
    }

    easeOutQuint(x: number): number {
        return 1 - Math.pow(1 - x, 5);
    }

    checkHotkeys() {
        let foundHotkey: Hotkey | undefined;
        for(let hk of this.hotkeys) {
            let isPressed = true;
            for(let k of hk.keys) {
                if(!this.keysPressed[k]) {
                    isPressed = false;
                    break;
                }
            }
            if(isPressed) {
                if(foundHotkey && hk.keys.length > foundHotkey.keys.length) foundHotkey = hk;
                else foundHotkey = hk;
            }
        }
        if(foundHotkey) {
            try {
                foundHotkey.callback();
            } catch (error) {
                console.error(error);
            }
        }
    }

    addHotkeys(keys: Array<number>, callback: () => void) {
        this.hotkeys.push({keys, callback});
    }
}

interface Hotkey {
    keys: Array<number>;
    callback: () => void;
}

interface Gun {
    name: string;
    rpm: number;
    recoils: Array<Recoil>;
    mode: 'loop' | 'start' | 'end'
}

interface Recoil {
    name: string;
    activate?: (number | 'left' | 'right')[];
    multipliers: [number, number];
    vecors: Vectors;
}
type Vectors = Array<[number, number]>