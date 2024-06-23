import { ObjectId, MongoClient, InsertOneResult } from 'mongodb'

const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'spotFleetDB';
const collectionName = 'fleetInfo';

export interface FleetInfo {
    _id?: ObjectId,
    primaryUniqueId: string;
    roleName: string;
    securityGroupId: string;
    spotFleetRequestId: string;
}

async function connectToMongo(): Promise<MongoClient> {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    return client;
}

export async function storeFleetInfo(fleetInfo: FleetInfo): Promise<ObjectId> {
    const client = await connectToMongo();

    try {
        const db = client.db(dbName);
        const collection = db.collection(collectionName);
        const result: InsertOneResult<FleetInfo> = await collection.insertOne(fleetInfo);
        return result.insertedId;
    } finally {
        client.close();
    }
}

export async function deleteFleetInfo(spotFleetId: string): Promise<void> {
    const client = await connectToMongo();

    try {
        const db = client.db(dbName);
        const collection = db.collection<FleetInfo>(collectionName);
        await collection.deleteOne({ spotFleetRequestId: spotFleetId });
    } finally {
        client.close();
    }
}

export async function getFleetInfoFromMongo(spotFleetId: string): Promise<FleetInfo | null> {
    const client = await connectToMongo();

    try {
        const db = client.db(dbName);
        const collection = db.collection<FleetInfo>(collectionName);
        return await collection.findOne({ spotFleetRequestId: spotFleetId });
    } finally {
        client.close();
    }
}