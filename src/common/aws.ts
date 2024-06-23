import {
    EC2Client, CreateSecurityGroupCommand, CreateSecurityGroupCommandInput, AuthorizeSecurityGroupIngressCommand,
    RequestSpotFleetCommand, RequestSpotFleetCommandInput, RequestSpotFleetCommandOutput, CancelSpotFleetRequestsCommand,
    CancelSpotFleetRequestsCommandInput,
    DeleteSecurityGroupCommand, DeleteSecurityGroupCommandInput
} from "@aws-sdk/client-ec2";
import {
    IAMClient, CreateRoleCommand as IAMCreateRoleCommand, CreateRoleCommandInput as IAMCreateRoleCommandInput,
    PutRolePolicyCommand as IAMPutRolePolicyCommand, PutRolePolicyCommandInput as IAMPutRolePolicyCommandInput,
    DetachRolePolicyCommand as IAMDetchRolePolicyCommand, DetachRolePolicyCommandInput as IAMDetchRolePolicyCommandInput,
    DeleteRoleCommand as IAMDeleteRoleCommand, DeleteRoleCommandInput as IAMDeleteRoleCommandInput
} from "@aws-sdk/client-iam";
import { v4 as uuidv4 } from 'uuid';

const ec2Client = new EC2Client({ region: "us-east-1" });
const iamClient = new IAMClient({ region: "us-east-1" });

const keyPairName = 'test';
const vpcId = 'vpc-05322bf757c9b2f06';
const instanceType = 't2.micro';
const availabilityZone = 'us-east-1a';
const amiId = 'ami-0e001c9271cf7f3b9';

async function createIAMRole(): Promise<{ roleArn: string; roleName: string }> {
    const roleName = `pw-spot-fleet-role-${uuidv4()}`;
    try {
        const createRoleParams: IAMCreateRoleCommandInput = {
            RoleName: roleName,
            AssumeRolePolicyDocument: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Principal: {
                            Service: "ec2.amazonaws.com",
                        },
                        Action: "sts:AssumeRole",
                    },
                ],
            }),
        };

        const createRoleCommand = new IAMCreateRoleCommand(createRoleParams);
        const createRoleResponse = await iamClient.send(createRoleCommand);
        const roleArn = createRoleResponse.Role?.Arn;

        if (!roleArn) {
            throw new Error("Failed to create role or retrieve role ARN");
        }

        console.log("Role created successfully:", roleArn);

        const policyDocument = {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: [
                        "ec2:Describe*",
                        "ec2:RequestSpotInstances",
                        "ec2:TerminateInstances",
                        "ec2:CreateTags",
                        "ec2:DeleteTags",
                        "ec2:DescribeSpotFleetInstances",
                        "ec2:CancelSpotFleetRequests",
                        "ec2:ModifySpotFleetRequest",
                        "iam:PassRole"
                    ],
                    Resource: "*",
                },
            ],
        };

        const putRolePolicyParams: IAMPutRolePolicyCommandInput = {
            RoleName: roleName,
            PolicyName: "EC2SpotFleetFullAccessPolicy",
            PolicyDocument: JSON.stringify(policyDocument),
        };

        const putRolePolicyCommand = new IAMPutRolePolicyCommand(putRolePolicyParams);
        await iamClient.send(putRolePolicyCommand);
        console.log("Policy attached successfully");

        return { roleArn, roleName };
    } catch (error) {
        console.error("Error creating role or attaching policy:", error);
        throw error;
    }
}

async function createSecurityGroup(): Promise<{ securityGroupId: string; groupName: string }> {
    const groupName = `pw-spot-fleet-sg-${uuidv4()}`;
    const groupDescription = 'Security group for Spot Fleet';

    try {
        const createSecurityGroupParams: CreateSecurityGroupCommandInput = {
            Description: groupDescription,
            GroupName: groupName,
            VpcId: vpcId
        };

        const createSecurityGroupCommand = new CreateSecurityGroupCommand(createSecurityGroupParams);
        const sgData = await ec2Client.send(createSecurityGroupCommand);

        const ipPermissions = [
            {
                IpProtocol: '-1', // -1 means all protocols
                FromPort: -1,     // -1 means all ports
                ToPort: -1,       // -1 means all ports
                IpRanges: [{ CidrIp: '0.0.0.0/0' }] // Allows all IPs
            }
        ];

        const authorizeSecurityGroupParams = {
            GroupId: sgData.GroupId!,
            IpPermissions: ipPermissions
        };

        const authorizeSecurityGroupCommand = new AuthorizeSecurityGroupIngressCommand(authorizeSecurityGroupParams);
        await ec2Client.send(authorizeSecurityGroupCommand);

        return { securityGroupId: sgData.GroupId!, groupName };
    } catch (error) {
        console.error("Error creating security group:", error);
        throw error;
    }
}

async function createSpotFleet(roleArn: string, securityGroupId: string): Promise<string> {
    const userDataScript = `#!/bin/bash
yum update -y
yum install -y docker
service docker start
usermod -a -G docker ec2-user
docker pull mcr.microsoft.com/playwright:v1.44.1-jammy`;

    try {
        const spotFleetParams: RequestSpotFleetCommandInput = {
            SpotFleetRequestConfig: {
                IamFleetRole: roleArn,
                AllocationStrategy: "lowestPrice",
                SpotPrice: "0.3",
                TargetCapacity: 1,
                LaunchSpecifications: [
                    {
                        ImageId: amiId,
                        InstanceType: instanceType,
                        KeyName: keyPairName,
                        SecurityGroups: [
                            {
                                GroupId: securityGroupId,
                            },
                        ],
                        Placement: {
                            AvailabilityZone: availabilityZone,
                        },
                        IamInstanceProfile: {
                            Arn: roleArn,
                        },
                        UserData: Buffer.from(userDataScript).toString("base64"),
                    },
                ],
            },
        };

        const requestSpotFleetCommand = new RequestSpotFleetCommand(spotFleetParams);
        const response: RequestSpotFleetCommandOutput = await ec2Client.send(requestSpotFleetCommand);
        console.log("Spot Fleet Request created successfully:", response);
        return response.SpotFleetRequestId || "No SpotFleetRequestId returned";
    } catch (error) {
        console.error("Error creating Spot Fleet Request:", error);
        throw error;
    }
}

async function deleteSecurityGroup(groupId: string): Promise<void> {
    try {
        const deleteSecurityGroupParams: DeleteSecurityGroupCommandInput = {
            GroupId: groupId
        };

        const deleteSecurityGroupCommand = new DeleteSecurityGroupCommand(deleteSecurityGroupParams);
        await ec2Client.send(deleteSecurityGroupCommand);
        console.log(`Security group ${groupId} deleted successfully.`);
    } catch (error) {
        console.error("Error deleting security group:", error);
        throw error;
    }
}

async function deleteIamRole(roleName: string): Promise<void> {
    try {
        const detachRolePolicyParams: IAMDetchRolePolicyCommandInput = {
            RoleName: roleName,
            PolicyArn: 'arn:aws:iam::aws:policy/service-role/AmazonEC2SpotFleetTaggingRole'
        };

        const detachRolePolicyCommand = new IAMDetchRolePolicyCommand(detachRolePolicyParams);
        await iamClient.send(detachRolePolicyCommand);

        const deleteRoleParams: IAMDeleteRoleCommandInput = {
            RoleName: roleName
        };

        const deleteRoleCommand = new IAMDeleteRoleCommand(deleteRoleParams);
        await iamClient.send(deleteRoleCommand);

        console.log(`IAM role ${roleName} deleted successfully.`);
    } catch (error) {
        console.error("Error deleting IAM role:", error);
        throw error;
    }
}

async function cancelSpotFleetRequest(spotFleetRequestId: string): Promise<void> {
    try {
        const cancelSpotFleetParams: CancelSpotFleetRequestsCommandInput = {
            SpotFleetRequestIds: [spotFleetRequestId],
            TerminateInstances: true
        };

        const cancelSpotFleetCommand = new CancelSpotFleetRequestsCommand(cancelSpotFleetParams);
        await ec2Client.send(cancelSpotFleetCommand);

        console.log(`Spot Fleet request ${spotFleetRequestId} cancelled successfully.`);
    } catch (error) {
        console.error("Error cancelling Spot Fleet request:", error);
        throw error;
    }
}

export {
    createIAMRole,
    createSecurityGroup,
    createSpotFleet,
    deleteSecurityGroup,
    deleteIamRole,
    cancelSpotFleetRequest
};
