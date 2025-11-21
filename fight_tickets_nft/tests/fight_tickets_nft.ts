import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FightTicketsNft } from "../target/types/fight_tickets_nft";
import { assert, expect } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import * as crypto from "crypto";
import * as nacl from "tweetnacl";

describe("fight_tickets_nft", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.FightTicketsNft as Program<FightTicketsNft>;
  
  const BASE_URI = "https://ticketsnft.fight.foundation";
  
  // Test accounts
  let collection: Keypair;
  let operator: Keypair;
  let apiSigner: Keypair; // API's keypair for signing proofs (separate from operator)
  let recipient1: Keypair;
  let recipient2: Keypair;

  beforeEach(async () => {
    collection = Keypair.generate();
    operator = Keypair.generate();
    apiSigner = Keypair.generate(); // Separate keypair for API proof signing
    recipient1 = Keypair.generate();
    recipient2 = Keypair.generate();

    // Airdrop SOL to test accounts
    await provider.connection.requestAirdrop(operator.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(recipient1.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(recipient2.publicKey, 2 * LAMPORTS_PER_SOL);
    
    // Wait for airdrops to confirm
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  // Helper function to create a valid proof signature
  function createProof(nftId: number, recipientPubkey: PublicKey, signerKeypair: Keypair): Buffer {
    // Create message: hash(recipient + nftId)
    const message = Buffer.concat([
      recipientPubkey.toBuffer(),
      Buffer.from(new Uint8Array(new Uint32Array([nftId]).buffer))
    ]);
    const hash = crypto.createHash('sha256').update(message).digest();
    
    // Sign the hash with the signer's private key using tweetnacl
    const signature = nacl.sign.detached(hash, signerKeypair.secretKey);
    
    return Buffer.from(signature);
  }

  // Helper function to get NFT account PDA
  function getNftPda(collectionPubkey: PublicKey, nftId: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("nft"),
        collectionPubkey.toBuffer(),
        Buffer.from(new Uint8Array(new Uint32Array([nftId]).buffer))
      ],
      program.programId
    );
  }

  // Helper function to create Ed25519 verification instruction
  function createEd25519Instruction(
    signature: Buffer,
    publicKey: PublicKey,
    message: Buffer
  ): TransactionInstruction {
    const ED25519_PROGRAM_ID = new PublicKey("Ed25519SigVerify111111111111111111111111111");
    
    // Ed25519 instruction data format
    const numSignatures = 1;
    const padding = 0;
    const signatureOffset = 16; // After header
    const signatureInstructionIndex = 0xffff; // Current instruction
    const publicKeyOffset = signatureOffset + 64;
    const publicKeyInstructionIndex = 0xffff;
    const messageDataOffset = publicKeyOffset + 32;
    const messageDataSize = message.length;
    const messageInstructionIndex = 0xffff;

    const data = Buffer.alloc(16 + 64 + 32 + message.length);
    
    // Header
    data.writeUInt8(numSignatures, 0);
    data.writeUInt8(padding, 1);
    data.writeUInt16LE(signatureOffset, 2);
    data.writeUInt16LE(signatureInstructionIndex, 4);
    data.writeUInt16LE(publicKeyOffset, 6);
    data.writeUInt16LE(publicKeyInstructionIndex, 8);
    data.writeUInt16LE(messageDataOffset, 10);
    data.writeUInt16LE(messageDataSize, 12);
    data.writeUInt16LE(messageInstructionIndex, 14);
    
    // Signature, public key, and message
    signature.copy(data, signatureOffset);
    publicKey.toBuffer().copy(data, publicKeyOffset);
    message.copy(data, messageDataOffset);

    return new TransactionInstruction({
      keys: [],
      programId: ED25519_PROGRAM_ID,
      data,
    });
  }

  // Helper to claim with proper ed25519 verification
  async function claimNft(
    nftId: number,
    recipient: Keypair,
    signerKeypair: Keypair,
    collectionPubkey: PublicKey,
  ) {
    const proof = createProof(nftId, recipient.publicKey, signerKeypair);
    const [nftPda] = getNftPda(collectionPubkey, nftId);

    // Create the message hash that was signed
    const message = Buffer.concat([
      recipient.publicKey.toBuffer(),
      Buffer.from(new Uint8Array(new Uint32Array([nftId]).buffer))
    ]);
    const messageHash = crypto.createHash('sha256').update(message).digest();

    // Create Ed25519 verification instruction
    const ed25519Ix = createEd25519Instruction(proof, signerKeypair.publicKey, messageHash);

    return await program.methods
      .claim(Array.from(proof), nftId, recipient.publicKey)
      .accounts({
        collection: collectionPubkey,
        nft: nftPda,
        payer: recipient.publicKey,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([ed25519Ix])
      .signers([recipient])
      .rpc();
  }

  describe("Initialization", () => {
    it("Initializes the NFT collection with correct parameters", async () => {
      const tx = await program.methods
        .initialize(apiSigner.publicKey, BASE_URI)
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([collection, operator])
        .rpc();

      console.log("Initialize transaction signature:", tx);

      // Fetch and verify collection state
      const collectionAccount = await program.account.nftCollection.fetch(collection.publicKey);
      
      assert.equal(collectionAccount.authority.toBase58(), operator.publicKey.toBase58());
      assert.equal(collectionAccount.signer.toBase58(), apiSigner.publicKey.toBase58());
      assert.equal(collectionAccount.isLocked, false);
      assert.equal(collectionAccount.totalSupply, 0);
      assert.equal(collectionAccount.baseUri, BASE_URI);
    });

    it("Initializes with separate API signer different from operator", async () => {
      const separateApiSigner = Keypair.generate();
      
      const tx = await program.methods
        .initialize(separateApiSigner.publicKey, BASE_URI)
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([collection, operator])
        .rpc();

      const collectionAccount = await program.account.nftCollection.fetch(collection.publicKey);
      
      // Verify operator and signer are different
      assert.notEqual(collectionAccount.authority.toBase58(), collectionAccount.signer.toBase58());
      assert.equal(collectionAccount.authority.toBase58(), operator.publicKey.toBase58());
      assert.equal(collectionAccount.signer.toBase58(), separateApiSigner.publicKey.toBase58());
    });

    it("Fails to initialize with unauthorized signer", async () => {
      const unauthorized = Keypair.generate();
      await provider.connection.requestAirdrop(unauthorized.publicKey, LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        await program.methods
          .initialize(apiSigner.publicKey, BASE_URI)
          .accounts({
            collection: collection.publicKey,
            authority: operator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([collection, unauthorized])
          .rpc();
        
        assert.fail("Should have failed with unauthorized signer");
      } catch (error) {
        // Expected to fail
        assert.ok(error);
      }
    });
  });

  describe("Claim NFT", () => {
    beforeEach(async () => {
      // Initialize collection before each claim test
      await program.methods
        .initialize(apiSigner.publicKey, BASE_URI)
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([collection, operator])
        .rpc();
    });

    it("Successfully claims an NFT with valid proof from API signer", async () => {
      const nftId = 42;
      const [nftPda] = getNftPda(collection.publicKey, nftId);

      const tx = await claimNft(nftId, recipient1, apiSigner, collection.publicKey);

      console.log("Claim transaction signature:", tx);

      // Verify NFT account
      const nftAccount = await program.account.nft.fetch(nftPda);
      assert.equal(nftAccount.nftId, nftId);
      assert.equal(nftAccount.owner.toBase58(), recipient1.publicKey.toBase58());
      assert.equal(nftAccount.collection.toBase58(), collection.publicKey.toBase58());

      // Verify collection supply increased
      const collectionAccount = await program.account.nftCollection.fetch(collection.publicKey);
      assert.equal(collectionAccount.totalSupply, 1);
    });

    it("Fails to claim with proof from unauthorized signer", async () => {
      const nftId = 43;
      const unauthorizedSigner = Keypair.generate();

      try {
        await claimNft(nftId, recipient1, unauthorizedSigner, collection.publicKey);
        assert.fail("Should have failed with proof from unauthorized signer");
      } catch (error) {
        assert.ok(error.toString().includes("Invalid proof"));
      }
    });

    it("Fails to claim with proof from operator (not API signer)", async () => {
      const nftId = 44;

      try {
        await claimNft(nftId, recipient1, operator, collection.publicKey);
        assert.fail("Should have failed with proof from operator instead of API signer");
      } catch (error) {
        assert.ok(error.toString().includes("Invalid proof"));
      }
    });

    it("Fails to claim NFT ID out of range", async () => {
      const nftId = 10000; // Out of range (max is 9999)
      const proof = createProof(nftId, recipient1.publicKey, apiSigner);
      const [nftPda] = getNftPda(collection.publicKey, nftId);

      try {
        await program.methods
          .claim(proof, nftId, recipient1.publicKey)
          .accounts({
            collection: collection.publicKey,
            nft: nftPda,
            payer: recipient1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([recipient1])
          .rpc();
        
        assert.fail("Should have failed with out of range NFT ID");
      } catch (error) {
        assert.ok(error.toString().includes("NFT ID out of range"));
      }
    });

    it("Fails to claim already claimed NFT", async () => {
      const nftId = 45;
      const [nftPda] = getNftPda(collection.publicKey, nftId);

      // First claim
      await claimNft(nftId, recipient1, apiSigner, collection.publicKey);

      // Try to claim again
      try {
        await claimNft(nftId, recipient2, apiSigner, collection.publicKey);
        
        assert.fail("Should have failed claiming already claimed NFT");
      } catch (error) {
        // Expected - account already exists
        assert.ok(error);
      }
    });
  });

  describe("Soulbound Transfer Restrictions", () => {
    let nftId: number;
    let nftPda: PublicKey;

    beforeEach(async () => {
      // Initialize and claim an NFT
      await program.methods
        .initialize(apiSigner.publicKey, BASE_URI)
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([collection, operator])
        .rpc();

      nftId = 100;
      [nftPda] = getNftPda(collection.publicKey, nftId);

      await claimNft(nftId, recipient1, apiSigner, collection.publicKey);
    });

    it("Prevents regular holder from transferring NFT", async () => {
      try {
        await program.methods
          .transfer(nftId, recipient2.publicKey)
          .accounts({
            collection: collection.publicKey,
            nft: nftPda,
            from: recipient1.publicKey,
            authority: recipient1.publicKey,
          })
          .signers([recipient1])
          .rpc();
        
        assert.fail("Regular holder should not be able to transfer");
      } catch (error) {
        assert.ok(error.toString().includes("Unauthorized") || error.toString().includes("constraint"));
      }
    });

    it("Allows operator to transfer NFT", async () => {
      const tx = await program.methods
        .transfer(nftId, recipient2.publicKey)
        .accounts({
          collection: collection.publicKey,
          nft: nftPda,
          from: recipient1.publicKey,
          authority: operator.publicKey,
        })
        .signers([operator])
        .rpc();

      console.log("Transfer transaction signature:", tx);

      // Verify new owner
      const nftAccount = await program.account.nft.fetch(nftPda);
      assert.equal(nftAccount.owner.toBase58(), recipient2.publicKey.toBase58());
    });
  });

  describe("Operator Functions", () => {
    let nftId: number;
    let nftPda: PublicKey;

    beforeEach(async () => {
      // Initialize and claim an NFT
      await program.methods
        .initialize(apiSigner.publicKey, BASE_URI)
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([collection, operator])
        .rpc();

      nftId = 200;
      [nftPda] = getNftPda(collection.publicKey, nftId);

      await claimNft(nftId, recipient1, apiSigner, collection.publicKey);
    });

    it("Allows operator to burn NFT", async () => {
      const tx = await program.methods
        .burn(nftId)
        .accounts({
          collection: collection.publicKey,
          nft: nftPda,
          authority: operator.publicKey,
          recipient: operator.publicKey,
        })
        .signers([operator])
        .rpc();

      console.log("Burn transaction signature:", tx);

      // Verify NFT account is closed
      try {
        await program.account.nft.fetch(nftPda);
        assert.fail("NFT account should be closed");
      } catch (error) {
        assert.ok(error.toString().includes("Account does not exist"));
      }

      // Verify collection supply decreased
      const collectionAccount = await program.account.nftCollection.fetch(collection.publicKey);
      assert.equal(collectionAccount.totalSupply, 0);
    });

    it("Prevents non-operator from burning NFT", async () => {
      try {
        await program.methods
          .burn(nftId)
          .accounts({
            collection: collection.publicKey,
            nft: nftPda,
            authority: recipient1.publicKey,
            recipient: recipient1.publicKey,
          })
          .signers([recipient1])
          .rpc();
        
        assert.fail("Non-operator should not be able to burn");
      } catch (error) {
        assert.ok(error.toString().includes("constraint") || error.toString().includes("Unauthorized"));
      }
    });
  });

  describe("Lock Mechanism", () => {
    beforeEach(async () => {
      // Initialize collection
      await program.methods
        .initialize(apiSigner.publicKey, BASE_URI)
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([collection, operator])
        .rpc();
    });

    it("Allows operator to lock the contract", async () => {
      const tx = await program.methods
        .lockContract()
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
        })
        .signers([operator])
        .rpc();

      console.log("Lock transaction signature:", tx);

      // Verify collection is locked
      const collectionAccount = await program.account.nftCollection.fetch(collection.publicKey);
      assert.equal(collectionAccount.isLocked, true);
    });

    it("Prevents non-operator from locking contract", async () => {
      try {
        await program.methods
          .lockContract()
          .accounts({
            collection: collection.publicKey,
            authority: recipient1.publicKey,
          })
          .signers([recipient1])
          .rpc();
        
        assert.fail("Non-operator should not be able to lock");
      } catch (error) {
        assert.ok(error.toString().includes("constraint") || error.toString().includes("Unauthorized"));
      }
    });

    it("Prevents claiming after contract is locked", async () => {
      // Lock the contract
      await program.methods
        .lockContract()
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
        })
        .signers([operator])
        .rpc();

      // Try to claim
      const nftId = 300;
      const proof = createProof(nftId, recipient1.publicKey, apiSigner);
      const [nftPda] = getNftPda(collection.publicKey, nftId);

      try {
        await program.methods
          .claim(proof, nftId, recipient1.publicKey)
          .accounts({
            collection: collection.publicKey,
            nft: nftPda,
            payer: recipient1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([recipient1])
          .rpc();
        
        assert.fail("Should not be able to claim after lock");
      } catch (error) {
        assert.ok(error.toString().includes("locked") || error.toString().includes("Contract is locked"));
      }
    });

    it("Prevents operator functions after contract is locked", async () => {
      // Claim an NFT first
      const nftId = 400;
      const [nftPda] = getNftPda(collection.publicKey, nftId);

      await claimNft(nftId, recipient1, apiSigner, collection.publicKey);

      // Lock the contract
      await program.methods
        .lockContract()
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
        })
        .signers([operator])
        .rpc();

      // Try to transfer
      try {
        await program.methods
          .transfer(nftId, recipient2.publicKey)
          .accounts({
            collection: collection.publicKey,
            nft: nftPda,
            from: recipient1.publicKey,
            authority: operator.publicKey,
          })
          .signers([operator])
          .rpc();
        
        assert.fail("Should not be able to transfer after lock");
      } catch (error) {
        assert.ok(error.toString().includes("locked") || error.toString().includes("Contract is locked"));
      }

      // Try to burn
      try {
        await program.methods
          .burn(nftId)
          .accounts({
            collection: collection.publicKey,
            nft: nftPda,
            authority: operator.publicKey,
            recipient: operator.publicKey,
          })
          .signers([operator])
          .rpc();
        
        assert.fail("Should not be able to burn after lock");
      } catch (error) {
        assert.ok(error.toString().includes("locked") || error.toString().includes("Contract is locked"));
      }
    });
  });

  describe("Update Signer", () => {
    let newSigner: Keypair;

    beforeEach(async () => {
      // Initialize collection
      await program.methods
        .initialize(apiSigner.publicKey, BASE_URI)
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([collection, operator])
        .rpc();

      newSigner = Keypair.generate();
    });

    it("Allows operator to update signer", async () => {
      const tx = await program.methods
        .updateSigner(newSigner.publicKey)
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
        })
        .signers([operator])
        .rpc();

      console.log("Update signer transaction signature:", tx);

      // Verify signer was updated
      const collectionAccount = await program.account.nftCollection.fetch(collection.publicKey);
      assert.equal(collectionAccount.signer.toBase58(), newSigner.publicKey.toBase58());
    });

    it("Prevents non-operator from updating signer", async () => {
      try {
        await program.methods
          .updateSigner(newSigner.publicKey)
          .accounts({
            collection: collection.publicKey,
            authority: recipient1.publicKey,
          })
          .signers([recipient1])
          .rpc();
        
        assert.fail("Non-operator should not be able to update signer");
      } catch (error) {
        assert.ok(error.toString().includes("constraint") || error.toString().includes("Unauthorized"));
      }
    });

    it("Allows claims with new signer after update", async () => {
      // Update signer
      await program.methods
        .updateSigner(newSigner.publicKey)
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
        })
        .signers([operator])
        .rpc();

      // Claim with new signer
      const nftId = 500;
      const [nftPda] = getNftPda(collection.publicKey, nftId);

      const tx = await claimNft(nftId, recipient1, newSigner, collection.publicKey);

      console.log("Claim with new signer transaction signature:", tx);

      // Verify NFT was claimed
      const nftAccount = await program.account.nft.fetch(nftPda);
      assert.equal(nftAccount.nftId, nftId);
      assert.equal(nftAccount.owner.toBase58(), recipient1.publicKey.toBase58());
    });

    it("Rejects claims with old signer after update", async () => {
      // Update signer
      await program.methods
        .updateSigner(newSigner.publicKey)
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
        })
        .signers([operator])
        .rpc();

      // Try to claim with old signer
      const nftId = 501;
      const proof = createProof(nftId, recipient1.publicKey, apiSigner); // Using old signer
      const [nftPda] = getNftPda(collection.publicKey, nftId);

      try {
        await program.methods
          .claim(proof, nftId, recipient1.publicKey)
          .accounts({
            collection: collection.publicKey,
            nft: nftPda,
            payer: recipient1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([recipient1])
          .rpc();
        
        assert.fail("Should not be able to claim with old signer after update");
      } catch (error) {
        assert.ok(error.toString().includes("Invalid proof"));
      }
    });

    it("Prevents updating signer after contract is locked", async () => {
      // Lock the contract
      await program.methods
        .lockContract()
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
        })
        .signers([operator])
        .rpc();

      // Try to update signer
      try {
        await program.methods
          .updateSigner(newSigner.publicKey)
          .accounts({
            collection: collection.publicKey,
            authority: operator.publicKey,
          })
          .signers([operator])
          .rpc();
        
        assert.fail("Should not be able to update signer after lock");
      } catch (error) {
        assert.ok(error.toString().includes("locked") || error.toString().includes("Contract is locked"));
      }
    });
  });

  describe("Update Base URI", () => {
    const NEW_BASE_URI = "https://new-api.fighttickets.com/metadata/";

    beforeEach(async () => {
      // Initialize collection
      await program.methods
        .initialize(apiSigner.publicKey, BASE_URI)
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([collection, operator])
        .rpc();
    });

    it("Allows operator to update base URI", async () => {
      const tx = await program.methods
        .updateBaseUri(NEW_BASE_URI)
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
        })
        .signers([operator])
        .rpc();

      console.log("Update base URI transaction signature:", tx);

      // Verify base URI was updated
      const collectionAccount = await program.account.nftCollection.fetch(collection.publicKey);
      assert.equal(collectionAccount.baseUri, NEW_BASE_URI);
    });

    it("Prevents non-operator from updating base URI", async () => {
      try {
        await program.methods
          .updateBaseUri(NEW_BASE_URI)
          .accounts({
            collection: collection.publicKey,
            authority: recipient1.publicKey,
          })
          .signers([recipient1])
          .rpc();
        
        assert.fail("Non-operator should not be able to update base URI");
      } catch (error) {
        assert.ok(error.toString().includes("constraint") || error.toString().includes("Unauthorized"));
      }
    });

    it("Prevents updating base URI after contract is locked", async () => {
      // Lock the contract
      await program.methods
        .lockContract()
        .accounts({
          collection: collection.publicKey,
          authority: operator.publicKey,
        })
        .signers([operator])
        .rpc();

      // Try to update base URI
      try {
        await program.methods
          .updateBaseUri(NEW_BASE_URI)
          .accounts({
            collection: collection.publicKey,
            authority: operator.publicKey,
          })
          .signers([operator])
          .rpc();
        
        assert.fail("Should not be able to update base URI after lock");
      } catch (error) {
        assert.ok(error.toString().includes("locked") || error.toString().includes("Contract is locked"));
      }
    });
  });
});
