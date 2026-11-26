import type {HouseOption} from './model';
import {DH_ROOMS} from '../dhRooms';
export const EXPENSE_HOUSES: HouseOption[] = DH_ROOMS.map(id => ({id, label: id.toUpperCase()}));
