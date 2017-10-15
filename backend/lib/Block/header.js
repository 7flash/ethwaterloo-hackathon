'use strict'
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const defineProperties = require('../serialize').defineProperties;
// secp256k1n/2
const N_DIV_2 = new BN('7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0', 16)

class BlockHeader {
  constructor (data) {
    data = data || {}
    // Define Properties
    const fields = [{
      name: 'blockNumber',
      alias: 'block',
      length: 4,
      allowLess: false,
      default: Buffer.alloc(4)
    }, {
      name: 'parentHash',
      allowZero: true,
      length: 32,
      allowLess: false,
      default: Buffer.alloc(32)
    }, {
      name: 'merkleRootHash',
      allowZero: true,
      alias: 'merkle',
      length: 32,
      allowLess: false,
      default: Buffer.alloc(32)
    }, {
      name: 'v',
      allowZero: true,
      length: 1,
      allowLess: false,
      default: Buffer.alloc(1)
    }, {
      name: 'r',
      length: 32,
      allowZero: true,
      allowLess: false,
      default: Buffer.alloc(32)
    }, {
      name: 's',
      length: 32,
      allowZero: true,
      allowLess: false,
      default: Buffer.alloc(32)
    }]

 defineProperties(this, fields, data)

    /**
     * @property {Buffer} from (read only) sender address of this transaction, mathematically derived from other parameters.
     * @name from
     * @memberof Transaction
     */
    Object.defineProperty(this, 'from', {
      enumerable: true,
      configurable: true,
      get: this.getSenderAddress.bind(this)
    })
  }

  /**
   * If the tx's `to` is to the creation address
   * @return {Boolean}
   */
  toCreationAddress () {
    return this.to.toString('hex') === ''
  }

  /**
   * Computes a sha3-256 hash of the serialized tx
   * @param {Boolean} [includeSignature=true] whether or not to inculde the signature
   * @return {Buffer}
   */
  hash (includeSignature) {
    if (includeSignature === undefined) includeSignature = true

    // EIP155 spec:
    // when computing the hash of a transaction for purposes of signing or recovering,
    // instead of hashing only the first six elements (ie. nonce, gasprice, startgas, to, value, data),
    // hash nine elements, with v replaced by CHAIN_ID, r = 0 and s = 0

    let items
    if (includeSignature) {
      items = this.raw
    } else {
        items = this.raw.slice(0, 3)
    }
    return ethUtil.sha3(Buffer.concat(items));
    // return ethUtil.hashPersonalMessage(Buffer.concat(items));

  }

  /**
   * returns the sender's address
   * @return {Buffer}
   */
  getSenderAddress () {
    if (this._from) {
      return this._from
    }
    const pubkey = this.getSenderPublicKey()
    this._from = ethUtil.publicToAddress(pubkey)
    return this._from
  }

  /**
   * returns the public key of the sender
   * @return {Buffer}
   */
  getSenderPublicKey () {
    if (!this._senderPubKey || !this._senderPubKey.length) {
      if (!this.verifySignature()) throw new Error('Invalid Signature')
    }
    return this._senderPubKey
  }

  /**
   * Determines if the signature is valid
   * @return {Boolean}
   */
  verifySignature () {
    const msgHash = this.hash(false)
    // All transaction signatures whose s-value is greater than secp256k1n/2 are considered invalid.
    if (new BN(this.s).cmp(N_DIV_2) === 1) {
      return false
    }

    try {
      let v = ethUtil.bufferToInt(this.v)
    //   if (this._chainId > 0) {
    //     v -= this._chainId * 2 + 8
    //   }
      this._senderPubKey = ethUtil.ecrecover(msgHash, v, this.r, this.s)
    } catch (e) {
      return false
    }

    return !!this._senderPubKey
  }

  /**
   * sign a transaction with a given a private key
   * @param {Buffer} privateKey
   */
  sign (privateKey) {
    const msgHash = this.hash(false)
    const sig = ethUtil.ecsign(msgHash, privateKey)
    if (sig.v < 27){
        sig.v += 27
    }
 
    Object.assign(this, sig)
  }


  /**
   * validates the signature and checks to see if it has enough gas
   * @param {Boolean} [stringError=false] whether to return a string with a dscription of why the validation failed or return a Bloolean
   * @return {Boolean|String}
   */
  validate (stringError) {
    const errors = []
    if (!this.verifySignature()) {
      errors.push('Invalid Signature')
    }
    if (stringError === undefined || stringError === false) {
      return errors.length === 0
    } else {
      return errors.join(' ')
    }
  }
}

module.exports = BlockHeader

