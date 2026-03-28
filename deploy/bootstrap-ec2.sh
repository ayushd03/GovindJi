#!/usr/bin/env bash
# Creates a minimal EC2 (t4g.micro) in your default VPC for Govind Ji Dry Fruits.
# Region: value of AWS_REGION or aws configure (default ap-south-1 in script fallback).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || true)}"
REGION="${REGION:-ap-south-1}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t4g.micro}"
KEY_NAME="${KEY_NAME:-govindji-app-$(date +%Y%m)}"
SG_NAME="govindji-web-sg"
PROFILE_NAME="GovindJiEC2Profile"
ROLE_NAME="GovindJiEC2Role"

AMI=""
while read -r id name; do
  case "$name" in *minimal*) continue ;; esac
  AMI="$id"
  break
done < <(aws ec2 describe-images --owners amazon \
  --region "$REGION" \
  --filters "Name=name,Values=al2023-ami-*-kernel-*-arm64" "Name=state,Values=available" \
  --query 'reverse(sort_by(Images,&CreationDate))[*].[ImageId,Name]' --output text)
if [[ -z "$AMI" ]]; then
  echo "Could not resolve a non-minimal AL2023 arm64 AMI in $REGION" >&2
  exit 1
fi

VPC_ID=$(aws ec2 describe-vpcs --region "$REGION" \
  --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
SUBNET_ID=$(aws ec2 describe-subnets --region "$REGION" \
  --filters Name=vpc-id,Values="$VPC_ID" Name=default-for-az,Values=true \
  --query 'Subnets[0].SubnetId' --output text)

echo "Using region=$REGION ami=$AMI subnet=$SUBNET_ID"

SG_ID=$(aws ec2 describe-security-groups --region "$REGION" \
  --filters "Name=group-name,Values=$SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)
if [[ "$SG_ID" == "None" || -z "$SG_ID" ]]; then
  SG_ID=$(aws ec2 create-security-group --region "$REGION" \
    --group-name "$SG_NAME" \
    --description "Govind Ji web (HTTP/HTTPS)" \
    --vpc-id "$VPC_ID" \
    --query 'GroupId' --output text)
  aws ec2 authorize-security-group-ingress --region "$REGION" \
    --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0
  aws ec2 authorize-security-group-ingress --region "$REGION" \
    --group-id "$SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0
  aws ec2 authorize-security-group-ingress --region "$REGION" \
    --group-id "$SG_ID" --protocol tcp --port 22 --cidr 0.0.0.0/0
  echo "Created security group $SG_ID"
else
  echo "Reusing security group $SG_ID"
  aws ec2 authorize-security-group-ingress --region "$REGION" \
    --group-id "$SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0 2>/dev/null || true
fi

DEPLOY_DIR="$REPO_ROOT/.deploy"
mkdir -p "$DEPLOY_DIR"
KEY_FILE="$DEPLOY_DIR/${KEY_NAME}.pem"

if [[ ! -f "$KEY_FILE" ]]; then
  aws ec2 create-key-pair --region "$REGION" --key-name "$KEY_NAME" \
    --query 'KeyMaterial' --output text >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
  echo "Saved new key to $KEY_FILE"
else
  echo "Key file exists: $KEY_FILE (not creating a new key pair on AWS if name differs — delete file to regenerate)"
fi

aws ec2 describe-key-pairs --region "$REGION" --key-names "$KEY_NAME" &>/dev/null || {
  echo "Key pair $KEY_NAME missing in AWS; create it or set KEY_NAME to match an existing pair."
  exit 1
}

PROFILE_ARGS=()
PROFILE_ARGS=()
if aws iam get-role --role-name "$ROLE_NAME" &>/dev/null; then
  if aws iam get-instance-profile --instance-profile-name "$PROFILE_NAME" &>/dev/null; then
    PROFILE_ARGS=( --iam-instance-profile "Name=$PROFILE_NAME" )
    echo "Using existing instance profile $PROFILE_NAME"
  fi
elif aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document "file://$SCRIPT_DIR/ec2-trust-policy.json" &>/dev/null; then
  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
  aws iam create-instance-profile --instance-profile-name "$PROFILE_NAME"
  aws iam add-role-to-instance-profile --instance-profile-name "$PROFILE_NAME" \
    --role-name "$ROLE_NAME"
  echo "Created IAM role + instance profile (SSM). Waiting for propagation…"
  sleep 15
  PROFILE_ARGS=( --iam-instance-profile "Name=$PROFILE_NAME" )
else
  echo "Skipping IAM instance profile (no iam:CreateRole permission). SSM Session Manager will not be available unless an admin attaches a profile later."
fi

USER_DATA=$(base64 <"$SCRIPT_DIR/user-data.sh" | tr -d '\n')

EXISTING_RUNNING=$(aws ec2 describe-instances --region "$REGION" \
  --filters "Name=tag:Project,Values=GovindJiDryFruits" "Name=instance-state-name,Values=running,pending" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text 2>/dev/null || true)
EXISTING_STOPPED=$(aws ec2 describe-instances --region "$REGION" \
  --filters "Name=tag:Project,Values=GovindJiDryFruits" "Name=instance-state-name,Values=stopped" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text 2>/dev/null || true)

if [[ -n "${EXISTING_RUNNING:-}" && "$EXISTING_RUNNING" != "None" ]]; then
  echo "Reusing running instance $EXISTING_RUNNING"
  IID="$EXISTING_RUNNING"
elif [[ -n "${EXISTING_STOPPED:-}" && "$EXISTING_STOPPED" != "None" ]]; then
  echo "Starting stopped instance $EXISTING_STOPPED"
  aws ec2 start-instances --region "$REGION" --instance-ids "$EXISTING_STOPPED"
  IID="$EXISTING_STOPPED"
else
  IID=$(aws ec2 run-instances --region "$REGION" \
    --image-id "$AMI" \
    --instance-type "$INSTANCE_TYPE" \
    --subnet-id "$SUBNET_ID" \
    --security-group-ids "$SG_ID" \
    --key-name "$KEY_NAME" \
    ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"} \
    --user-data "$USER_DATA" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=govindji-dryfruits},{Key=Project,Value=GovindJiDryFruits}]" \
    --query 'Instances[0].InstanceId' --output text)
  echo "Launched new instance $IID"
fi

aws ec2 wait instance-running --region "$REGION" --instance-ids "$IID"
PUBLIC_IP=$(aws ec2 describe-instances --region "$REGION" --instance-ids "$IID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

echo ""
echo "=== Instance ready ==="
echo "InstanceId: $IID"
echo "Public IP:  $PUBLIC_IP"
echo "SSH:        ssh -i $KEY_FILE ec2-user@$PUBLIC_IP"
echo ""
echo "Set on the server in /opt/govindji/backend/.env (copy from local backend/.env and adjust):"
echo "  FRONTEND_URL=http://$PUBLIC_IP"
echo "  BASE_URL=http://$PUBLIC_IP"
echo "  CLIENT_URL=http://$PUBLIC_IP"
echo ""
echo "Deploy:     env REACT_APP_API_URL= \"$REPO_ROOT/deploy/deploy-to-ec2.sh\" $PUBLIC_IP"
echo "(Empty REACT_APP_API_URL makes the SPA call /api on the same host via nginx.)"

echo "$PUBLIC_IP" >"$DEPLOY_DIR/last-public-ip"
echo "$IID" >"$DEPLOY_DIR/last-instance-id"
echo "$KEY_FILE" >"$DEPLOY_DIR/last-key-file"
