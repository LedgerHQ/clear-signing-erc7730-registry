// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AuditTracker
 * @notice Tracks Cyfrin audit findings and their resolution status
 * @dev Manages the 191 issues / 304 findings from Cyfrin audit at commit a2b33ff
 */
contract AuditTracker {
    enum FindingStatus { Open, Fixed, ReviewPending, Verified }
    
    struct Finding {
        uint256 issueId;
        string description;
        FindingStatus status;
        string fixCommit;
        uint256 reviewFindings;
    }
    
    uint256 public constant TOTAL_ISSUES = 191;
    uint256 public constant TOTAL_FINDINGS = 304;
    uint256 public constant REVIEW_ISSUES = 7;
    uint256 public constant REVIEW_FINDINGS = 10;
    
    mapping(uint256 => Finding) public findings;
    uint256 public resolvedCount;
    uint256 public reviewResolvedCount;
    
    event FindingResolved(uint256 indexed issueId, string fixCommit);
    event ReviewFindingAdded(uint256 indexed issueId, uint256 findingCount);
    
    constructor() {
        // Initialize with known fixed commits from master
        _markFixed(1, "0478d57"); // fix(permit): correct EIP-712 domains
        _markFixed(2, "b2686cc"); // fix(permit): show unlimited ap
        resolvedCount = 2;
    }
    
    function _markFixed(uint256 issueId, string memory commit) internal {
        findings[issueId] = Finding({
            issueId: issueId,
            description: "",
            status: FindingStatus.Fixed,
            fixCommit: commit,
            reviewFindings: 0
        });
    }
    
    function getProgress() external view returns (uint256 resolved, uint256 total, uint256 reviewResolved, uint256 reviewTotal) {
        return (resolvedCount, TOTAL_FINDINGS, reviewResolvedCount, REVIEW_FINDINGS);
    }
    
    function markReviewResolved(uint256 issueId) external {
        require(findings[issueId].status == FindingStatus.Fixed, "Issue not fixed");
        findings[issueId].status = FindingStatus.Verified;
        reviewResolvedCount++;
        emit FindingResolved(issueId, findings[issueId].fixCommit);
    }
}
