;; VaultTrack: Secure Digital Asset Management Contract
;; This contract provides a comprehensive solution for tracking and managing digital assets
;; with robust security, role-based access control, and comprehensive error handling.

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; ERROR CODES
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(define-constant ERR_UNAUTHORIZED u401)
(define-constant ERR_INSUFFICIENT_BALANCE u402)
(define-constant ERR_ASSET_NOT_FOUND u404)
(define-constant ERR_INVALID_OPERATION u400)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; CONTRACT OWNER
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(define-data-var contract-owner principal tx-sender)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; ASSET MAPS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Map to track fungible token balances
(define-map fungible-balances {
    owner: principal, 
    asset-type: (string-ascii 50)
} uint)

;; Map to track non-fungible asset ownership
(define-map nft-ownership {
    asset-type: (string-ascii 50),
    token-id: uint
} principal)

;; Map to track authorized users
(define-map authorized-users principal bool)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; ACCESS CONTROL
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(define-private (is-contract-owner (sender principal))
    (is-eq sender (var-get contract-owner))
)

(define-private (is-authorized-user (sender principal))
    (default-to false (map-get? authorized-users sender))
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; AUTHORIZATION MODIFIERS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(define-private (check-owner)
    (begin
        (asserts! (is-contract-owner tx-sender) (err ERR_UNAUTHORIZED))
        (ok true)
    )
)

(define-private (check-authorized)
    (begin
        (asserts! 
            (or 
                (is-contract-owner tx-sender)
                (is-authorized-user tx-sender)
            ) 
            (err ERR_UNAUTHORIZED)
        )
        (ok true)
    )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; ADMIN FUNCTIONS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Add an authorized user
(define-public (add-authorized-user (user principal))
    (begin
        (try! (check-owner))
        (map-set authorized-users user true)
        (ok true)
    )
)

;; Remove an authorized user
(define-public (remove-authorized-user (user principal))
    (begin
        (try! (check-owner))
        (map-delete authorized-users user)
        (ok true)
    )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; FUNGIBLE TOKEN MANAGEMENT
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Deposit fungible tokens
(define-public (deposit-fungible 
    (asset-type (string-ascii 50)) 
    (amount uint)
)
    (let 
        (
            (current-balance 
                (default-to u0 
                    (map-get? fungible-balances {
                        owner: tx-sender, 
                        asset-type: asset-type
                    })
                )
            )
        )
        (try! (check-authorized))
        (map-set fungible-balances {
            owner: tx-sender, 
            asset-type: asset-type
        } (+ current-balance amount))
        (ok amount)
    )
)

;; Withdraw fungible tokens
(define-public (withdraw-fungible 
    (asset-type (string-ascii 50)) 
    (amount uint)
)
    (let 
        (
            (current-balance 
                (default-to u0 
                    (map-get? fungible-balances {
                        owner: tx-sender, 
                        asset-type: asset-type
                    })
                )
            )
        )
        (try! (check-authorized))
        (asserts! (>= current-balance amount) (err ERR_INSUFFICIENT_BALANCE))
        
        (map-set fungible-balances {
            owner: tx-sender, 
            asset-type: asset-type
        } (- current-balance amount))
        (ok amount)
    )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; NON-FUNGIBLE TOKEN MANAGEMENT
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Register a non-fungible asset
(define-public (register-nft 
    (asset-type (string-ascii 50)) 
    (token-id uint)
)
    (begin
        (try! (check-authorized))
        (map-set nft-ownership {
            asset-type: asset-type, 
            token-id: token-id
        } tx-sender)
        (ok true)
    )
)

;; Transfer non-fungible asset
(define-public (transfer-nft 
    (asset-type (string-ascii 50)) 
    (token-id uint) 
    (recipient principal)
)
    (let 
        (
            (current-owner 
                (unwrap! 
                    (map-get? nft-ownership {
                        asset-type: asset-type, 
                        token-id: token-id
                    }) 
                    (err ERR_ASSET_NOT_FOUND)
                )
            )
        )
        (asserts! (is-eq tx-sender current-owner) (err ERR_UNAUTHORIZED))
        
        (map-set nft-ownership {
            asset-type: asset-type, 
            token-id: token-id
        } recipient)
        (ok true)
    )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; READ-ONLY FUNCTIONS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Get fungible token balance
(define-read-only (get-fungible-balance 
    (owner principal) 
    (asset-type (string-ascii 50))
)
    (default-to u0 
        (map-get? fungible-balances {
            owner: owner, 
            asset-type: asset-type
        })
    )
)

;; Get non-fungible asset owner
(define-read-only (get-nft-owner 
    (asset-type (string-ascii 50)) 
    (token-id uint)
)
    (map-get? nft-ownership {
        asset-type: asset-type, 
        token-id: token-id
    })
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; EMERGENCY FUNCTIONS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Freeze an asset (only by contract owner)
(define-public (freeze-asset 
    (asset-type (string-ascii 50)) 
    (token-id (optional uint))
)
    (begin
        (try! (check-owner))
        ;; Placeholder for emergency freeze logic
        (ok true)
    )
)