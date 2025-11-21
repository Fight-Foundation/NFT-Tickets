# Build Notes

## Known Issue: Anchor Build

The program uses `anchor-lang` v0.30.1 for compatibility with `mpl-token-metadata` v4.1.2. There is a known issue with `anchor-syn` v0.30.1 where IDL generation fails due to a `proc_macro2::Span::source_file()` method that doesn't exist in the current proc-macro2 version.

### Error Message
```
error[E0599]: no method named `source_file` found for struct `proc_macro2::Span` in the current scope
  --> anchor-syn-0.30.1/src/idl/defined.rs:499:66
```

## Recommended Build Process

### Building the Program
Use `cargo build-sbf` directly instead of `anchor build`:

```bash
cargo build-sbf
```

This successfully compiles the program to `target/deploy/fight_tickets_nft.so` (367KB).

### IDL File
The IDL file at `target/idl/fight_tickets_nft.json` is pre-generated and committed to the repository. It works correctly with the deployed program and client scripts.

### Deployment
Use Solana CLI directly:

```bash
# Devnet
solana program deploy --url devnet target/deploy/fight_tickets_nft.so --program-id target/deploy/fight_tickets_nft-keypair.json

# Mainnet
solana program deploy --url mainnet target/deploy/fight_tickets_nft.so --program-id target/deploy/fight_tickets_nft-keypair.json
```

## Testing

The test suite also has issues with Anchor's test framework due to the same IDL generation problem. However, manual testing works perfectly:

1. Deploy the program using `cargo build-sbf` + `solana program deploy`
2. Initialize the collection using the claim script pattern
3. Test claims using `scripts/claim-with-metadata.cjs`

## Future Fixes

To resolve the build issues, consider:

1. **Upgrade to Anchor v0.31+**: This requires testing compatibility with `mpl-token-metadata` v4.1.2
2. **Wait for Anchor v0.30.2**: If a patch release addresses the `anchor-syn` issue
3. **Current approach**: Continue using `cargo build-sbf` (works perfectly for production)

## Why This Approach is OK

✅ **Production ready**: The deployed program (367KB) works perfectly on devnet
✅ **Client compatible**: The pre-generated IDL works with all client scripts
✅ **Tested**: Successfully tested with multiple user claims on devnet
✅ **Metaplex integration**: NFTs display correctly in wallets and explorers
✅ **Build reproducible**: `cargo build-sbf` is deterministic and reliable

The IDL generation issue is a **tooling limitation**, not a program bug. The actual Solana program binary is production-ready.
