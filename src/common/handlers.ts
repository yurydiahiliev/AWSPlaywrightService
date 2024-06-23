import { Request, Response } from 'express';
import { createIAMRole, createSecurityGroup, createSpotFleet, deleteSecurityGroup, deleteIamRole, cancelSpotFleetRequest } from './aws';
import { storeFleetInfo, deleteFleetInfo, FleetInfo, getFleetInfoFromMongo } from './mongo';

export async function handleCreateSpotFleetRequest(request: Request, response: Response) {
    try {
        
        const { roleArn, roleName } = await createIAMRole();
        const { securityGroupId } = await createSecurityGroup();
        const spotFleetRequestId = await createSpotFleet(roleArn, securityGroupId);


        const fleetInfo: FleetInfo = {
            primaryUniqueId: new Date().toISOString(),
            roleName,
            securityGroupId,
            spotFleetRequestId
        };
        const insertedId = await storeFleetInfo(fleetInfo);

        // Respond with success message and data
        response.status(201).json({
            message: 'Spot Fleet Request Created',
            data: { ...fleetInfo, insertedId }
        });
    } catch (err) {
        console.error('Error creating Spot Fleet request:', err);
        response.status(500).json({ message: 'Error creating Spot Fleet request', error: err.message });
    }
}

export async function handleDeleteSpotFleet(request: Request<{ spotFleetId: string }>, response: Response) {
    const { spotFleetId } = request.params;

    try {
        // Retrieve fleet information from MongoDB
        const fleetInfo = await getFleetInfoFromMongo(spotFleetId);
        if (!fleetInfo) {
            throw new Error('Fleet info not found in database');
        }

        // Cancel Spot Fleet request
        await cancelSpotFleetRequest(spotFleetId);

        // Delete security group
        await deleteSecurityGroup(fleetInfo.securityGroupId);

        // Delete IAM role
        await deleteIamRole(fleetInfo.roleName);

        // Delete fleet information from MongoDB
        await deleteFleetInfo(spotFleetId);

        // Respond with success message
        response.status(200).json({ message: 'Spot Fleet Request Cancelled and resources deleted', spotFleetId });
    } catch (err) {
        console.error('Error cancelling Spot Fleet request:', err);
        response.status(500).json({ message: 'Error cancelling Spot Fleet request', error: err.message });
    }
}
