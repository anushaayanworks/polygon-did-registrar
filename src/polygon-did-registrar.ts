import * as dot from 'dotenv';
import { polygonDIDRegistryABI } from './PolygonDIDRegistryABI';
import { toEthereumAddress } from 'did-jwt';
import * as log4js from "log4js";
const bs58 = require('bs58')
const ethers = require('ethers');
const EC = require('elliptic').ec;

dot.config();

const secp256k1 = new EC('secp256k1');

const url = process.env.URL;
const DID_ADDRESS = `${process.env.DID_ADDRESS}`;
const provider = new ethers.providers.JsonRpcProvider(url);

let wallet = new ethers.Wallet(`${process.env.PRIVATE_KEY}`, provider);
let registry = new ethers.Contract(DID_ADDRESS, polygonDIDRegistryABI, wallet);

const logger = log4js.getLogger();
logger.level = process.env.LOGGER_LEVEL;


/**
 * Create and return DID Document
 * @param did 
 * @param address 
 * @returns 
 */
async function wrapDidDocument(did: string, publicKeyBase58: string, address: string): Promise<object> {
    return {
        '@context': 'https://w3id.org/did/v1',
        id: did,
        "verificationMethod": [
            {
                "id": did,
                "type": "EcdsaSecp256k1VerificationKey2019", // external (property value)
                "controller": did,
                "publicKeyBase58": publicKeyBase58,
            }
        ]
    }
}

/**
 * Create public and private key and generate address
 * @returns 
 */
async function createKeyPair(): Promise<any> {

    try {
        const kp = secp256k1.genKeyPair()
        const publicKey = kp.getPublic('hex');
        const privateKey = kp.getPrivate('hex');
        const address = toEthereumAddress(publicKey);

        const bufferPublicKey = Buffer.from(publicKey, 'hex');
        const publicKeyBase58 = bs58.encode(bufferPublicKey);

        const bufferPrivateKey = Buffer.from(privateKey, 'hex');
        const privateKeyBase58 = bs58.encode(bufferPrivateKey);

        return { address, publicKeyBase58, privateKeyBase58 };

    } catch (error) {

        logger.error(`Error occurred in createKeyPair function ${error}`)
        throw error;
    }
}


/**
 * Register DID document on matic chain
 * @returns 
 */
export async function registerDID(): Promise<object> {

    try {
        const { address, publicKeyBase58, privateKeyBase58 } = await createKeyPair();

        // DID format
        const did = `did:polygon:${address}`;

        // Get DID document
        const didDoc = await wrapDidDocument(did, publicKeyBase58, address);

        const stringDIDDoc = JSON.stringify(didDoc);

        // Calling createDID with Create DID and register on match chain 
        const returnAddress = await createDid(address, stringDIDDoc);

        logger.debug(`returnAddress - ${JSON.stringify(returnAddress)} \n\n\n`);
        return { did, returnAddress };
    } catch (error) {

        logger.error(`Error occurred in registerDID function  ${error}`)
        throw error;
    }
}

/**
 * Register DID document on matic chain  
 * @param address 
 * @param DidDoc 
 * @returns 
 */
async function createDid(address: string, DidDoc: string) {
    try {

        // Calling smart contract with register DID document on matic chain
        let returnHashValues = await registry.functions.createDID(address, DidDoc)
            .then((resHashValue) => {
                return resHashValue;
            })
        return returnHashValues;
    }
    catch (error) {

        logger.error(`Error occurred in createDid function  ${error}`)
        throw error;
    }
}