import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals, assertStringEquals } from 'https://deno.land/std@0.170.0/testing/asserts.ts';

// Helper functions for common test scenarios
function getRandomAssetType(): string {
  const types = ['STX', 'BTC', 'ETH', 'USDC', 'CUSTOM'];
  return types[Math.floor(Math.random() * types.length)];
}

Clarinet.test({
  name: "Initialization Tests: Verify contract owner is set correctly on deployment",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;

    // Call read-only function to get contract owner
    const ownerResult = chain.callReadOnlyFn(
      'vault-track', 
      'get-nft-owner', 
      [types.ascii('TEST'), types.uint(0)], 
      deployer.address
    );

    // Since this is a read-only function that doesn't relate to owner, 
    // we'll verify owner through direct contract interaction
    const authCallBlock = chain.mineBlock([
      Tx.contractCall('vault-track', 'add-authorized-user', 
        [types.principal(deployer.address)], 
        deployer.address
      )
    ]);

    // This call should succeed if the deployer is indeed the owner
    authCallBlock.receipts[0].result.expectOk();
  }
});

Clarinet.test({
  name: "Authorization Tests: Add and remove authorized users",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;

    // Add authorized user by owner
    let block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'add-authorized-user', 
        [types.principal(wallet1.address)], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Try to add authorized user by non-owner (should fail)
    block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'add-authorized-user', 
        [types.principal(wallet2.address)], 
        wallet1.address
      )
    ]);
    block.receipts[0].result.expectErr().expectUint(401);

    // Remove authorized user
    block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'remove-authorized-user', 
        [types.principal(wallet1.address)], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();
  }
});

Clarinet.test({
  name: "Fungible Token Tests: Deposit and withdraw tokens",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    // Add wallet1 as authorized user first
    let block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'add-authorized-user', 
        [types.principal(wallet1.address)], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();

    const assetType = getRandomAssetType();
    const depositAmount = 1000;

    // Deposit tokens
    block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'deposit-fungible', 
        [
          types.ascii(assetType), 
          types.uint(depositAmount)
        ], 
        wallet1.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Check balance
    const balanceResult = chain.callReadOnlyFn(
      'vault-track', 
      'get-fungible-balance', 
      [
        types.principal(wallet1.address), 
        types.ascii(assetType)
      ], 
      wallet1.address
    );
    balanceResult.result.expectUint(depositAmount);

    // Withdraw tokens
    block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'withdraw-fungible', 
        [
          types.ascii(assetType), 
          types.uint(depositAmount)
        ], 
        wallet1.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Check balance is zero
    const finalBalanceResult = chain.callReadOnlyFn(
      'vault-track', 
      'get-fungible-balance', 
      [
        types.principal(wallet1.address), 
        types.ascii(assetType)
      ], 
      wallet1.address
    );
    finalBalanceResult.result.expectUint(0);
  }
});

Clarinet.test({
  name: "Fungible Token Tests: Insufficient balance handling",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    // Add wallet1 as authorized user first
    let block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'add-authorized-user', 
        [types.principal(wallet1.address)], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();

    const assetType = getRandomAssetType();

    // Try to withdraw without depositing first
    block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'withdraw-fungible', 
        [
          types.ascii(assetType), 
          types.uint(100)
        ], 
        wallet1.address
      )
    ]);
    block.receipts[0].result.expectErr().expectUint(402); // Insufficient balance
  }
});

Clarinet.test({
  name: "Non-Fungible Token Tests: Register and transfer NFT",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;

    // Add wallets as authorized users
    let block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'add-authorized-user', 
        [types.principal(wallet1.address)], 
        deployer.address
      ),
      Tx.contractCall(
        'vault-track', 
        'add-authorized-user', 
        [types.principal(wallet2.address)], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();
    block.receipts[1].result.expectOk();

    const assetType = getRandomAssetType();
    const tokenId = 1;

    // Register NFT
    block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'register-nft', 
        [
          types.ascii(assetType), 
          types.uint(tokenId)
        ], 
        wallet1.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Check owner
    const ownerResult = chain.callReadOnlyFn(
      'vault-track', 
      'get-nft-owner', 
      [
        types.ascii(assetType), 
        types.uint(tokenId)
      ], 
      wallet1.address
    );
    assertEquals(ownerResult.result, `(some ${wallet1.address})`);

    // Transfer NFT
    block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'transfer-nft', 
        [
          types.ascii(assetType), 
          types.uint(tokenId),
          types.principal(wallet2.address)
        ], 
        wallet1.address
      )
    ]);
    block.receipts[0].result.expectOk();

    // Check new owner
    const newOwnerResult = chain.callReadOnlyFn(
      'vault-track', 
      'get-nft-owner', 
      [
        types.ascii(assetType), 
        types.uint(tokenId)
      ], 
      wallet1.address
    );
    assertEquals(newOwnerResult.result, `(some ${wallet2.address})`);
  }
});

Clarinet.test({
  name: "Security Tests: Freeze asset by owner",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;

    const assetType = getRandomAssetType();
    const tokenId = 2;

    // Non-owner trying to freeze asset (should fail)
    let block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'freeze-asset', 
        [
          types.ascii(assetType), 
          types.some(types.uint(tokenId))
        ], 
        wallet1.address
      )
    ]);
    block.receipts[0].result.expectErr().expectUint(401);

    // Owner freezing asset
    block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'freeze-asset', 
        [
          types.ascii(assetType), 
          types.some(types.uint(tokenId))
        ], 
        deployer.address
      )
    ]);
    block.receipts[0].result.expectOk();
  }
});

Clarinet.test({
  name: "Error Handling: Unauthorized access to protected functions",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;

    const assetType = getRandomAssetType();
    const tokenId = 3;

    // Unauthorized user tries to deposit fungible tokens
    let block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'deposit-fungible', 
        [
          types.ascii(assetType), 
          types.uint(500)
        ], 
        wallet1.address
      )
    ]);
    block.receipts[0].result.expectErr().expectUint(401);

    // Unauthorized user tries to register NFT
    block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'register-nft', 
        [
          types.ascii(assetType), 
          types.uint(tokenId)
        ], 
        wallet1.address
      )
    ]);
    block.receipts[0].result.expectErr().expectUint(401);

    // Unauthorized NFT transfer
    block = chain.mineBlock([
      Tx.contractCall(
        'vault-track', 
        'transfer-nft', 
        [
          types.ascii(assetType), 
          types.uint(tokenId),
          types.principal(wallet2.address)
        ], 
        wallet1.address
      )
    ]);
    block.receipts[0].result.expectErr().expectUint(404); // No asset found
  }
});